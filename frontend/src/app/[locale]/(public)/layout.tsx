import Image from "next/image";
import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f6f4] text-[#1a1a1a] flex flex-col">
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[#00331a]/90 via-[#006633] to-[#00331a]/90 text-white shadow-md">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/favicon.png"
              alt="Universidad Tecnológica de La Habana, Cujae"
              width={100}
              height={115}
              className="h-12 w-auto shrink-0"
              priority
            />
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold sm:text-base">
                Universidad Tecnológica de La Habana, Cujae
              </span>
              <span className="text-xs text-[#c9e9da] sm:text-sm">
                Dirección de Recursos Humanos
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="hover:text-[#c9e9da] transition-colors">Inicio</Link>
            <Link href="/plantilla" className="hover:text-[#c9e9da] transition-colors">Plantilla</Link>
            <Link href="/descargas" className="hover:text-[#c9e9da] transition-colors">Descargas</Link>
            <Link href="/portal" className="rounded-md bg-white/15 px-4 py-2 hover:bg-white/25 transition-colors">
              Panel administrativo
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t border-[#d1d5db] bg-white py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-[#52525b]">
          © 2026 Dirección de Recursos Humanos · Universidad Tecnológica de La Habana (CUJAE)
        </div>
      </footer>
    </div>
  );
}
