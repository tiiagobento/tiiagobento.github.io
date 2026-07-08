"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, CalendarClock, Edit, Eye, MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LeadPriorityBadge, LeadScoreBadge, LeadStatusBadge } from "@/components/lead-badges";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { SearchAndFilters, type LeadFilters } from "@/components/search-and-filters";
import { interactionTypes, leadStatuses, priorities } from "@/lib/constants";
import { isStaleLead } from "@/lib/business";
import type { Interaction, Lead, LeadStatus, Priority } from "@/lib/types";

type LeadTableProps = {
  leads: Lead[];
  onDelete: (id: string) => Promise<void>;
  onUpdateLead: (id: string, input: Partial<Lead>) => Promise<Lead>;
  onRecordLastContact: (id: string) => Promise<void>;
  onAddInteraction: (leadId: string, input: Omit<Interaction, "id" | "lead_id" | "created_at">) => Promise<void>;
};

export function LeadTable({ leads, onDelete, onUpdateLead, onRecordLastContact, onAddInteraction }: LeadTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "first_contact_date", desc: true }]);
  const [rowSelection, setRowSelection] = React.useState({});
  const [savingAction, setSavingAction] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<LeadFilters>({
    query: "",
    status: "Todos",
    source: "Todas",
    priority: "Todas",
    city: "Todas",
    assignedTo: "Todos",
  });

  const cities = React.useMemo(() => Array.from(new Set(leads.map((lead) => lead.city).filter(Boolean))) as string[], [leads]);
  const assignees = React.useMemo(() => Array.from(new Set(leads.map((lead) => lead.assigned_to).filter(Boolean))) as string[], [leads]);

  async function runLeadAction(key: string, action: () => Promise<void>) {
    setSavingAction(key);
    try {
      await action();
    } finally {
      setSavingAction(null);
    }
  }

  const filteredLeads = React.useMemo(() => {
    const q = filters.query.toLowerCase();
    return leads.filter((lead) => {
      const matchesQuery = !q || [lead.name, lead.phone, lead.city, lead.neighborhood, lead.notes].filter(Boolean).join(" ").toLowerCase().includes(q);
      const matchesStatus = filters.status === "Todos" || lead.status === filters.status;
      const matchesSource = filters.source === "Todas" || lead.source === filters.source;
      const matchesPriority = filters.priority === "Todas" || lead.priority === filters.priority;
      const matchesCity = filters.city === "Todas" || lead.city === filters.city;
      const matchesAssigned = filters.assignedTo === "Todos" || lead.assigned_to === filters.assignedTo;
      return matchesQuery && matchesStatus && matchesSource && matchesPriority && matchesCity && matchesAssigned;
    });
  }, [filters, leads]);

  const columns = React.useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => <input type="checkbox" checked={table.getIsAllRowsSelected()} onChange={table.getToggleAllRowsSelectedHandler()} />,
        cell: ({ row }) => <input type="checkbox" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Cliente <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div>
            <Link href={`/leads/${row.original.id}`} className="font-medium hover:text-accent">
              {row.original.name}
            </Link>
            <p className="text-xs text-muted-foreground">{row.original.phone}</p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <QuickSelect
            value={row.original.status}
            options={leadStatuses}
            disabled={savingAction === `${row.original.id}:status`}
            renderValue={<LeadStatusBadge status={row.original.status} />}
            onChange={(status) => runLeadAction(`${row.original.id}:status`, () => onUpdateLead(row.original.id, { status: status as LeadStatus }).then(() => undefined))}
          />
        ),
      },
      {
        accessorKey: "priority",
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Prioridade <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: ({ row }) => (
          <QuickSelect
            value={row.original.priority}
            options={priorities}
            disabled={savingAction === `${row.original.id}:priority`}
            renderValue={<LeadPriorityBadge priority={row.original.priority} />}
            onChange={(priority) => runLeadAction(`${row.original.id}:priority`, () => onUpdateLead(row.original.id, { priority: priority as Priority }).then(() => undefined))}
          />
        ),
      },
      {
        accessorKey: "source",
        header: "Origem",
      },
      {
        accessorKey: "city",
        header: "Cidade",
        cell: ({ row }) => (
          <div>
            <p>{row.original.city || "A confirmar"}</p>
            <p className="text-xs text-muted-foreground">{row.original.neighborhood}</p>
          </div>
        ),
      },
      {
        accessorKey: "lead_score",
        header: "Score",
        cell: ({ row }) => <LeadScoreBadge score={row.original.lead_score} />,
      },
      {
        accessorKey: "first_contact_date",
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Data <ArrowUpDown className="size-3" />
          </button>
        ),
      },
      {
        id: "flags",
        header: "Alertas",
        cell: ({ row }) => (isStaleLead(row.original) ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">Parado +3d</span> : <span className="text-xs text-muted-foreground">Em dia</span>),
      },
      {
        id: "actions",
        header: "Acoes",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="icon" variant="outline">
              <Link href={`/leads/${row.original.id}`} aria-label="Ver lead">
                <Eye className="size-4" />
              </Link>
            </Button>
            <Button asChild size="icon" variant="outline">
              <Link href={`/leads/${row.original.id}?edit=1`} aria-label="Editar lead">
                <Edit className="size-4" />
              </Link>
            </Button>
            <WhatsAppButton lead={row.original} size="icon" />
            <Button
              size="icon"
              variant="outline"
              disabled={savingAction === `${row.original.id}:contact`}
              onClick={() => runLeadAction(`${row.original.id}:contact`, () => onRecordLastContact(row.original.id))}
              aria-label="Registrar ultimo contato"
            >
              <CalendarClock className="size-4" />
            </Button>
            <InteractionDialog lead={row.original} onSave={onAddInteraction} />
            <DeleteLeadDialog lead={row.original} onDelete={onDelete} />
          </div>
        ),
      },
    ],
    [onAddInteraction, onDelete, onRecordLastContact, onUpdateLead, savingAction],
  );

  const table = useReactTable({
    data: filteredLeads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    state: { sorting, rowSelection },
  });

  return (
    <div className="space-y-4">
      <SearchAndFilters filters={filters} onChange={setFilters} cities={cities} assignees={assignees} />
      <div className="overflow-hidden rounded-xl border bg-card/95 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-primary text-primary-foreground">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-white/82">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b transition duration-150 hover:bg-secondary/45">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3.5 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Nenhum lead encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t bg-secondary/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {Object.keys(rowSelection).length} selecionado(s) de {filteredLeads.length} leads.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Pagina {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
            </span>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Proxima
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickSelect({
  value,
  options,
  renderValue,
  disabled,
  onChange,
}: {
  value: string;
  options: readonly string[];
  renderValue: React.ReactNode;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger className="h-auto min-h-9 w-[170px] border-0 bg-transparent px-1 shadow-none focus:ring-1">
        <SelectValue>{renderValue}</SelectValue>
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

function DeleteLeadDialog({ lead, onDelete }: { lead: Lead; onDelete: LeadTableProps["onDelete"] }) {
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Excluir lead">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acao remove permanentemente <strong>{lead.name}</strong> e tambem apaga interacoes e tarefas vinculadas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting}
            onClick={async (event) => {
              event.preventDefault();
              setDeleting(true);
              try {
                await onDelete(lead.id);
                setOpen(false);
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function InteractionDialog({ lead, onSave }: { lead: Lead; onSave: LeadTableProps["onAddInteraction"] }) {
  const [type, setType] = React.useState("WhatsApp");
  const [description, setDescription] = React.useState("");
  const [nextStep, setNextStep] = React.useState("");
  const [nextContact, setNextContact] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" aria-label="Registrar interacao">
          <MessageSquarePlus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar interacao</DialogTitle>
          <DialogDescription>{lead.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {interactionTypes.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="O que aconteceu no contato?" />
          <Input value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder="Proximo passo" />
          <Input type="datetime-local" value={nextContact} onChange={(event) => setNextContact(event.target.value)} />
          <Button
            disabled={saving}
            onClick={async () => {
              if (!description.trim()) {
                toast.error("Descreva o contato antes de salvar.");
                return;
              }
              setSaving(true);
              try {
                await onSave(lead.id, {
                  interaction_type: type,
                  responsible: lead.assigned_to ?? "Tiago",
                  description,
                  next_step: nextStep,
                  next_contact_at: nextContact ? new Date(nextContact).toISOString() : null,
                });
                setDescription("");
                setNextStep("");
                setNextContact("");
                setOpen(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Salvando..." : "Salvar interacao"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
