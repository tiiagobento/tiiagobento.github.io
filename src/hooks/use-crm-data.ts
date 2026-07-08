"use client";

import * as React from "react";
import { toast } from "sonner";
import { addHours } from "date-fns";
import { buildFollowUpTaskFromInteraction, normalizeLead, normalizeTask } from "@/lib/crm-records";
import { interactionSchema } from "@/lib/schemas";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { Interaction, Lead, MessageTemplate, Profile, Task } from "@/lib/types";

type CrmState = {
  leads: Lead[];
  interactions: Interaction[];
  tasks: Task[];
  templates: MessageTemplate[];
  profiles: Profile[];
};

function uuid() {
  return crypto.randomUUID();
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

export function useCrmData() {
  const [state, setState] = React.useState<CrmState>({ leads: [], interactions: [], tasks: [], templates: [], profiles: [] });
  const [loading, setLoading] = React.useState(true);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = React.useState<Profile | null>(null);
  const [configurationError, setConfigurationError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Supabase nao configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      setUserEmail(userData.user?.email ?? null);

      if (!userData.user) {
        setCurrentProfile(null);
        setState({ leads: [], interactions: [], tasks: [], templates: [], profiles: [] });
        return;
      }

      const { data: ownProfile } = await supabase.from("profiles").select("*").eq("id", userData.user.id).maybeSingle();
      setCurrentProfile((ownProfile as Profile | null) ?? null);

      const [
        { data: leads, error: leadsError },
        { data: interactions, error: interactionsError },
        { data: tasks, error: tasksError },
        { data: templates, error: templatesError },
        { data: profiles, error: profilesError },
      ] = await Promise.all([
        supabase.from("leads").select("*").order("updated_at", { ascending: false }),
        supabase.from("interactions").select("*").order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("message_templates").select("*").order("title", { ascending: true }),
        supabase.from("profiles").select("*").order("name", { ascending: true }),
      ]);

      if (leadsError) throw leadsError;
      if (interactionsError) throw interactionsError;
      if (tasksError) throw tasksError;
      if (templatesError) throw templatesError;
      if (profilesError && ownProfile?.role === "admin") throw profilesError;

      setConfigurationError(null);
      setState({
        leads: (leads ?? []) as Lead[],
        interactions: (interactions ?? []) as Interaction[],
        tasks: (tasks ?? []) as Task[],
        templates: (templates ?? []) as MessageTemplate[],
        profiles: (profiles ?? []) as Profile[],
      });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Nao foi possivel carregar os dados do Supabase.";
      setConfigurationError(message);
      toast.error(message);
      setState({ leads: [], interactions: [], tasks: [], templates: [], profiles: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveLead(input: Partial<Lead> & Pick<Lead, "name" | "phone">) {
    const nextLead = normalizeLead(input);
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Usuario nao autenticado");
      const payload = { ...nextLead, user_id: userData.user.id };
      const { data, error } = await supabase.from("leads").upsert(payload).select("*").single();
      if (error) throw error;
      toast.success("Lead salvo com sucesso.");
      await refresh();
      return data as Lead;
    } catch (error) {
      const message = getErrorMessage(error, "Erro ao salvar lead.");
      console.error("Erro ao salvar lead:", message, error);
      toast.error(message);
      throw error;
    }
  }

  async function deleteLead(id: string) {
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
      await refresh();
      toast.success("Lead removido.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir lead.");
    }
  }

  async function updateLead(id: string, input: Partial<Lead>) {
    const lead = state.leads.find((item) => item.id === id);
    if (!lead) throw new Error("Lead nao encontrado.");
    return saveLead({ ...lead, ...input });
  }

  async function recordLastContact(id: string) {
    await updateLead(id, { last_contact_at: new Date().toISOString() });
    toast.success("Ultimo contato atualizado.");
  }

  async function moveLead(id: string, status: Lead["status"]) {
    await updateLead(id, { status });
  }

  async function addInteraction(leadId: string, input: Omit<Interaction, "id" | "lead_id" | "created_at">) {
    const now = new Date().toISOString();
    try {
      const lead = state.leads.find((item) => item.id === leadId);
      if (!lead) throw new Error("Lead valido nao encontrado para registrar interacao.");
      const parsed = interactionSchema.parse(input);
      const interaction: Interaction = { ...parsed, id: uuid(), lead_id: leadId, created_at: now };
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Usuario nao autenticado");
      const payload = { ...interaction, user_id: userData.user.id };
      const { error } = await supabase.from("interactions").insert(payload);
      if (error) throw error;

      const task = buildFollowUpTaskFromInteraction({ lead, leadId, interaction: parsed });
      if (task) {
        const { error: taskError } = await supabase.from("tasks").insert({ ...task, user_id: userData.user.id });
        if (taskError) throw taskError;
      }

      const { error: leadError } = await supabase
        .from("leads")
        .update({ last_contact_at: now, next_action_at: parsed.next_contact_at ?? lead.next_action_at, updated_at: now })
        .eq("id", leadId);
      if (leadError) throw leadError;

      await refresh();
      toast.success("Interacao registrada.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao registrar interacao.");
      throw error;
    }
  }

  async function updateInteraction(id: string, input: Omit<Interaction, "id" | "lead_id" | "created_at">) {
    try {
      const existing = state.interactions.find((item) => item.id === id);
      if (!existing) throw new Error("Interacao nao encontrada.");
      const lead = state.leads.find((item) => item.id === existing.lead_id);
      if (!lead) throw new Error("Lead valido nao encontrado para atualizar interacao.");
      const parsed = interactionSchema.parse(input);
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Usuario nao autenticado");

      const { error } = await supabase.from("interactions").update(parsed).eq("id", id);
      if (error) throw error;

      const task = parsed.next_contact_at && !existing.next_contact_at ? buildFollowUpTaskFromInteraction({ lead, leadId: existing.lead_id, interaction: parsed }) : null;
      if (task) {
        const { error: taskError } = await supabase.from("tasks").insert({ ...task, user_id: userData.user.id });
        if (taskError) throw taskError;
      }

      await refresh();
      toast.success("Interacao atualizada.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar interacao.");
      throw error;
    }
  }

  async function deleteInteraction(id: string) {
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { error } = await supabase.from("interactions").delete().eq("id", id);
      if (error) throw error;
      await refresh();
      toast.success("Interacao excluida.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir interacao.");
      throw error;
    }
  }

  async function saveTask(input: Partial<Task> & Pick<Task, "title" | "due_date" | "priority" | "status">) {
    const task = normalizeTask(input);
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Usuario nao autenticado");
      const { error } = await supabase.from("tasks").upsert({ ...task, user_id: userData.user.id });
      if (error) throw error;
      await refresh();
      toast.success("Tarefa salva.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar tarefa.");
      throw error;
    }
  }

  async function saveTasks(inputs: Array<Partial<Task> & Pick<Task, "title" | "due_date" | "priority" | "status">>) {
    const tasks = inputs.map(normalizeTask);
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Usuario nao autenticado");
      const payload = tasks.map((task) => ({ ...task, user_id: userData.user.id }));
      const { error } = await supabase.from("tasks").insert(payload);
      if (error) throw error;
      await refresh();
      toast.success(`${tasks.length} acoes criadas.`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar acoes automatizadas.");
      throw error;
    }
  }

  async function completeTask(id: string) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;
    await saveTask({ ...task, status: "concluida", due_date: task.due_date, priority: task.priority });
  }

  async function deleteTask(id: string) {
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      await refresh();
      toast.success("Tarefa excluida.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir tarefa.");
      throw error;
    }
  }

  async function saveTemplate(input: Partial<MessageTemplate> & Pick<MessageTemplate, "title" | "category" | "content">) {
    const now = new Date().toISOString();
    const template: MessageTemplate = {
      id: input.id ?? uuid(),
      title: input.title,
      category: input.category,
      content: input.content,
      created_at: input.created_at ?? now,
      updated_at: now,
    };
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Usuario nao autenticado");
      const { error } = await supabase.from("message_templates").upsert({ ...template, user_id: userData.user.id });
      if (error) throw error;
      await refresh();
      toast.success("Template salvo.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar template.");
    }
  }

  async function deleteTemplate(id: string) {
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { error } = await supabase.from("message_templates").delete().eq("id", id);
      if (error) throw error;
      await refresh();
      toast.success("Template removido.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover template.");
    }
  }

  async function signOut() {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setUserEmail(null);
    setCurrentProfile(null);
    setState({ leads: [], interactions: [], tasks: [], templates: [], profiles: [] });
    toast.success("Sessao encerrada.");
  }

  async function updatePartnerVisit(
    leadId: string,
    input: Pick<Lead, "visit_status" | "partner_notes" | "partner_visit_feedback">,
  ) {
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { error } = await supabase.rpc("partner_update_visit_feedback", {
        target_lead_id: leadId,
        new_visit_status: input.visit_status ?? null,
        new_partner_notes: input.partner_notes ?? null,
        new_partner_visit_feedback: input.partner_visit_feedback ?? null,
      });
      if (error) throw error;
      await refresh();
      toast.success("Retorno da visita registrado.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao registrar retorno da visita.");
      throw error;
    }
  }

  async function importLeads(rows: Array<Record<string, string>>) {
    for (const row of rows) {
      await saveLead({
        name: row.name || row.nome || "Lead importado",
        phone: row.phone || row.telefone || row.whatsapp || "",
        email: row.email || "",
        source: (row.source || row.origem || "Outro") as Lead["source"],
        status: (row.status || "Novo lead") as Lead["status"],
        priority: (row.priority || row.prioridade || "Media") as Lead["priority"],
        city: row.city || row.cidade || "",
        neighborhood: row.neighborhood || row.bairro || "",
        project_type: row.project_type as Lead["project_type"],
        notes: row.notes || row.observacoes || "",
        first_contact_date: row.first_contact_date || row.data || new Date().toISOString().slice(0, 10),
        next_action_at: addHours(new Date(), 24).toISOString(),
      });
    }
    toast.success("CSV importado.");
  }

  return {
    ...state,
    loading,
    userEmail,
    currentProfile,
    configurationError,
    refresh,
    saveLead,
    deleteLead,
    updateLead,
    recordLastContact,
    moveLead,
    addInteraction,
    updateInteraction,
    deleteInteraction,
    saveTask,
    saveTasks,
    completeTask,
    deleteTask,
    saveTemplate,
    deleteTemplate,
    signOut,
    importLeads,
    updatePartnerVisit,
  };
}
