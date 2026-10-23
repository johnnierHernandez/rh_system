"""
Patrón Object Pool: reutiliza conexiones costosas (pymssql) en vez de
crearlas y destruirlas en cada request.

Reglas del pool:

* Nada vuelve al pool sin comprobar que sigue viva. Una conexión que el
  servidor cerró por tiempo de inactividad se descarta y se abre otra.
* Una conexión que falla durante una operación tampoco vuelve al pool: se
  descarta. Así una conexión rota no se propaga a la petición siguiente.
* Si no se puede crear una conexión, la capacidad del pool no se consume: se
  devuelve el contador, para que un fallo puntual del servidor no deje el
  pool permanentemente más pequeño.
* Al apagar el servicio, `close()` devuelve todas las conexiones.
"""

from __future__ import annotations

import queue
import threading
import time
from contextlib import contextmanager
from typing import Any, Callable, Iterator

# Conexiones ociosas más de este tiempo se validan antes de entregarlas.
# Por debajo, se da por buena: se usó hace un momento y no da tiempo a que el
# servidor la haya cerrado.
VALIDAR_OCIOSO_SEGUNDOS = 30.0


class ConnectionPool:
    def __init__(
        self,
        factory: Callable[[], Any],
        max_size: int = 8,
        prewarm: int = 2,
        timeout: float = 30.0,
    ) -> None:
        self._factory = factory
        self._max_size = max_size
        self._timeout = timeout
        self._pool: queue.Queue = queue.Queue(maxsize=max_size)
        self._created = 0
        self._lock = threading.Lock()
        self._closed = False
        # Marca de tiempo en que cada conexión volvió al pool, para saber
        # cuánto lleva ociosa.
        self._ocioso_desde: dict[int, float] = {}

        for _ in range(min(prewarm, max_size)):
            try:
                conn = self._create()
                self._pool.put(conn)
                self._ocioso_desde[id(conn)] = time.monotonic()
                with self._lock:
                    self._created += 1
            except Exception:
                # Si la BD no está lista en el arranque, se crea bajo demanda.
                break

    def _create(self) -> Any:
        return self._factory()

    def _discard(self, conn: Any) -> None:
        """Cierra una conexión y libera su sitio en el pool."""
        if conn is None:
            return
        self._ocioso_desde.pop(id(conn), None)
        try:
            conn.close()
        except Exception:
            pass
        with self._lock:
            if self._created > 0:
                self._created -= 1

    def _is_alive(self, conn: Any) -> bool:
        """Comprueba que la conexión sigue sirviendo."""
        if self._closed:
            return False
        if getattr(conn, "closed", False):
            return False
        try:
            cur = conn.cursor()
            try:
                cur.execute("SELECT 1")
                cur.fetchone()
            finally:
                try:
                    cur.close()
                except Exception:
                    pass
            return True
        except Exception:
            return False

    def _take(self) -> Any:
        """Saca una conexión de la cola validando la que lleve mucho ociosa."""
        conn = self._pool.get_nowait()
        desde = self._ocioso_desde.pop(id(conn), 0.0)
        if desde and (time.monotonic() - desde) > VALIDAR_OCIOSO_SEGUNDOS:
            if not self._is_alive(conn):
                self._discard(conn)
                raise TimeoutError("Conexión caduca")
        return conn

    def acquire(self) -> Any:
        if self._closed:
            raise RuntimeError("El pool de conexiones está cerrado")

        try:
            return self._take()
        except queue.Empty:
            pass
        except TimeoutError:
            # La que había estaba caduca: se abre una nueva si hay sitio.
            pass

        with self._lock:
            if self._closed:
                raise RuntimeError("El pool de conexiones está cerrado")
            if self._created < self._max_size:
                self._created += 1
                try:
                    return self._create()
                except Exception:
                    if self._created > 0:
                        self._created -= 1
                    raise

        try:
            return self._take()
        except queue.Empty:
            raise TimeoutError(
                f"No hay conexiones libres en el pool (timeout={self._timeout}s)"
            ) from None
        except TimeoutError:
            # Se agotó el tiempo y la que había estaba caduca: se reintenta
            # una vez con una conexión nueva.
            return self.acquire()

    def release(self, conn: Any) -> None:
        if conn is None:
            return
        if self._closed or not self._is_alive(conn):
            self._discard(conn)
            return
        try:
            self._pool.put_nowait(conn)
        except queue.Full:
            self._discard(conn)
            return
        self._ocioso_desde[id(conn)] = time.monotonic()

    @contextmanager
    def connection(self) -> Iterator[Any]:
        conn = self.acquire()
        try:
            yield conn
        except Exception:
            # La operación falló: la conexión puede haber quedado rota (error
            # de red) o con un estado raro. Se descarta y no vuelve al pool.
            self._discard(conn)
            raise
        else:
            self.release(conn)

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
        while True:
            try:
                conn = self._pool.get_nowait()
            except queue.Empty:
                break
            self._ocioso_desde.pop(id(conn), None)
            try:
                conn.close()
            except Exception:
                pass
        with self._lock:
            self._created = 0
        self._ocioso_desde.clear()
