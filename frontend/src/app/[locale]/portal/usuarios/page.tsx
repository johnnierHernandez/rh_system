import type { Metadata } from "next";
import UsuariosExplorer from "./usuarios-explorer";

export const metadata: Metadata = { title: "Usuarios | DRHnet" };

export default function UsuariosPage() {
  return <UsuariosExplorer />;
}