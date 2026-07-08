"use client";

import * as React from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useCrmData } from "@/hooks/use-crm-data";
import { downloadCsv, leadsToCsv, parseLeadCsv } from "@/lib/csv";

const exampleCsv = `name,phone,source,status,priority,city,neighborhood,project_type,notes
Cliente Exemplo,+55 48 99999-9999,Site,Novo lead,Alta,Florianopolis,Centro,Casa em steel frame,Quer visita sem compromisso`;

export default function ImportExportPage() {
  const { leads, importLeads } = useCrmData();
  const [csv, setCsv] = React.useState(exampleCsv);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Importar CSV</CardTitle>
          <CardDescription>Cole um CSV com cabecalho. Campos aceitos: name, phone, source, status, priority, city, neighborhood, project_type, notes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={csv} onChange={(event) => setCsv(event.target.value)} className="min-h-72 font-mono text-xs" />
          <Button onClick={() => importLeads(parseLeadCsv(csv))}>
            <Upload className="size-4" />
            Importar leads
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Exportar CSV</CardTitle>
          <CardDescription>Baixe todos os leads filtraveis para backup, analise ou compartilhamento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-secondary p-5">
            <p className="text-4xl font-semibold">{leads.length}</p>
            <p className="text-sm text-muted-foreground">leads prontos para exportacao</p>
          </div>
          <Button variant="accent" onClick={() => downloadCsv("nova-forma-leads.csv", leadsToCsv(leads))}>
            <Download className="size-4" />
            Exportar CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
