import type { Metadata } from "next";
import MisAreasExplorer from "./mis-areas-explorer";

export const metadata: Metadata = { title: "Mis áreas | DRHnet" };

export default function MisAreasPage() {
  return <MisAreasExplorer />;
}
