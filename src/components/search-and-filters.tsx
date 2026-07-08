"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { leadSources, leadStatuses, priorities } from "@/lib/constants";

export type LeadFilters = {
  query: string;
  status: string;
  source: string;
  priority: string;
  city: string;
  assignedTo: string;
};

export function SearchAndFilters({
  filters,
  onChange,
  cities,
  assignees,
}: {
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
  cities: string[];
  assignees: string[];
}) {
  const set = (key: keyof LeadFilters, value: string) => onChange({ ...filters, [key]: value });
  return (
    <div className="grid gap-3 rounded-xl border bg-card/90 p-3 shadow-sm lg:grid-cols-[1.5fr_repeat(5,1fr)]">
      <div className="flex items-center rounded-md border bg-background/80 px-3 shadow-xs">
        <Search className="mr-2 size-4 text-muted-foreground" />
        <Input className="border-0 bg-transparent px-0 focus-visible:ring-0" placeholder="Buscar por nome, telefone, cidade..." value={filters.query} onChange={(event) => set("query", event.target.value)} />
      </div>
      <FilterSelect value={filters.status} onValueChange={(v) => set("status", v)} placeholder="Status" options={["Todos", ...leadStatuses]} />
      <FilterSelect value={filters.source} onValueChange={(v) => set("source", v)} placeholder="Origem" options={["Todas", ...leadSources]} />
      <FilterSelect value={filters.priority} onValueChange={(v) => set("priority", v)} placeholder="Prioridade" options={["Todas", ...priorities]} />
      <FilterSelect value={filters.city} onValueChange={(v) => set("city", v)} placeholder="Cidade" options={["Todas", ...cities]} />
      <FilterSelect value={filters.assignedTo} onValueChange={(v) => set("assignedTo", v)} placeholder="Responsavel" options={["Todos", ...assignees]} />
    </div>
  );
}

function FilterSelect({ value, onValueChange, options, placeholder }: { value: string; onValueChange: (value: string) => void; options: string[]; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
