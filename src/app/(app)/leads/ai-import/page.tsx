import { AILeadImport } from "@/components/ai/AILeadImport";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { getAIProviderStatus } from "@/lib/ai/provider";

export default function AILeadImportPage() {
  const serverAI = getAIProviderStatus();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Card className="page-hero">
        <CardContent className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-accent">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Preencher lead com IA</h1>
            <p className="mt-1 text-sm text-white/72">Cole conversas ou envie prints para gerar um rascunho revisavel antes de criar o lead.</p>
          </div>
        </CardContent>
      </Card>
      <AILeadImport serverAIConfigured={serverAI.configured} serverProvider={serverAI.name} />
    </div>
  );
}
