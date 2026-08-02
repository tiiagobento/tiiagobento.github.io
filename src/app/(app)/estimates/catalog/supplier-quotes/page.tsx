import { ReceiptText } from "lucide-react";
import Link from "next/link";

import { SupplierQuoteImport } from "@/components/steel-frame/supplier-quote-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function SupplierQuotePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Card className="page-hero">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-accent"><ReceiptText className="size-5" /></span><div><h1 className="text-2xl font-semibold">Cotacoes de fornecedor</h1><p className="mt-1 text-sm text-white/72">Leitura assistida, revisao humana e historico imutavel de custos comerciais.</p></div></div>
          <Button asChild variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"><Link href="/estimates/catalog">Voltar ao catalogo</Link></Button>
        </CardContent>
      </Card>
      <SupplierQuoteImport />
    </div>
  );
}
