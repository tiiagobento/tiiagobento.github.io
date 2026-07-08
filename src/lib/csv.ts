import Papa from "papaparse";
import type { Lead } from "@/lib/types";

export function leadsToCsv(leads: Lead[]) {
  return Papa.unparse(
    leads.map((lead) => ({
      name: lead.name,
      phone: lead.phone,
      email: lead.email ?? "",
      source: lead.source,
      status: lead.status,
      priority: lead.priority,
      city: lead.city ?? "",
      neighborhood: lead.neighborhood ?? "",
      project_type: lead.project_type ?? "",
      approximate_area: lead.approximate_area ?? "",
      has_land: lead.has_land ?? "",
      has_blueprint: lead.has_blueprint ?? "",
      potential_value: lead.potential_value ?? "",
      closing_probability: lead.closing_probability ?? "",
      notes: lead.notes ?? "",
    })),
  );
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseLeadCsv(text: string) {
  return Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  }).data;
}
