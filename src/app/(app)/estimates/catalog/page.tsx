import { Boxes } from "lucide-react";
import { MaterialCatalog } from "@/components/steel-frame/material-catalog";
import { Card, CardContent } from "@/components/ui/card";

export default function EstimateCatalogPage() {
  return <div className="mx-auto max-w-6xl space-y-5"><Card className="page-hero"><CardContent className="flex gap-3 p-5 sm:p-6"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-accent"><Boxes className="size-5" /></span><div><h1 className="text-2xl font-semibold">Catalogo Steel Frame</h1><p className="mt-1 text-sm text-white/72">Materiais e precos reais para sustentar quantitativos explicaveis.</p></div></CardContent></Card><MaterialCatalog /></div>;
}
