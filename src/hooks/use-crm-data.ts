"use client";

import * as React from "react";
import { toast } from "sonner";
import { addHours } from "date-fns";
import { buildFollowUpTaskFromInteraction, normalizeLead, normalizeTask } from "@/lib/crm-records";
import { clearOfflineDbForUser, type OfflineSyncMode } from "@/lib/offline/db";
import { useNetworkStatus } from "@/lib/offline/network-status";
import { loadCrmSnapshot, putLocalRecord, putSyncedLocalRecord, saveCrmSnapshot } from "@/lib/offline/offline-store";
import { enqueueOperation, getSyncSummary, retryFailedOperations, syncPendingOperations, type SyncSummary } from "@/lib/offline/sync-queue";
import { interactionSchema } from "@/lib/schemas";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { clearPrivateRuntimeCache } from "@/lib/offline/pwa-cache";
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
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = React.useState<Profile | null>(null);
  const [configurationError, setConfigurationError] = React.useState<string | null>(null);
  const [syncSummary, setSyncSummary] = React.useState<SyncSummary>({ pending: 0, failed: 0, conflict: 0, operations: [] });
  const [syncing, setSyncing] = React.useState(false);
  const automaticSyncInProgress = React.useRef(false);
  const network = useNetworkStatus();

  const refreshSyncSummary = React.useCallback(async (userId = currentUserId) => {
    setSyncSummary(await getSyncSummary(userId));
  }, [currentUserId]);

  async function getCachedUser() {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  }

  async function getUserIdForWrite() {
    if (currentUserId) return currentUserId;
    const user = await getCachedUser();
    if (user?.id) return user.id;
    throw new Error(network.online ? "Usuario nao autenticado" : "Voce esta offline. Conecte-se a internet para renovar sua sessao.");
  }

  const loadOfflineSnapshot = React.useCallback(async (userId: string, message = "Voce esta offline. Mostrando dados sincronizados neste dispositivo.") => {
    const snapshot = await loadCrmSnapshot(userId);
    if (!snapshot) throw new Error("Voce esta offline e ainda nao ha dados sincronizados neste dispositivo.");
    setState(snapshot);
    setConfigurationError(message);
    await refreshSyncSummary(userId);
    toast.info(message);
  }, [refreshSyncSummary]);

  function updateLocalState(updater: (current: CrmState) => CrmState) {
    setState((current) => updater(current));
  }

  async function queueOfflineChange({
    entity,
    entityId,
    userId,
    operation,
    data,
    syncMode,
  }: {
    entity: "leads" | "tasks" | "interactions" | "message_templates";
    entityId: string;
    userId: string;
    operation: "create" | "update" | "delete";
    data: unknown;
    syncMode?: OfflineSyncMode;
  }) {
    await enqueueOperation({ entity, entityId, userId, operation, data, syncMode });
    await putLocalRecord(entity, data as { id: string; user_id?: string | null }, userId, operation);
    await refreshSyncSummary(userId);
    toast.info("Voce esta offline. Essa acao sera sincronizada quando a conexao voltar.");
  }

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Supabase nao configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      }

      const cachedUser = await getCachedUser();
      if (!network.online && cachedUser?.id) {
        setCurrentUserId(cachedUser.id);
        setUserEmail(cachedUser.email ?? null);
        await loadOfflineSnapshot(cachedUser.id);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      setUserEmail(userData.user?.email ?? null);
      setCurrentUserId(userData.user?.id ?? null);

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

      const nextState = {
        leads: (leads ?? []) as Lead[],
        interactions: (interactions ?? []) as Interaction[],
        tasks: (tasks ?? []) as Task[],
        templates: (templates ?? []) as MessageTemplate[],
        profiles: (profiles ?? []) as Profile[],
      };

      const mergedSnapshot = await saveCrmSnapshot(userData.user.id, nextState);
      setConfigurationError(null);
      setState(mergedSnapshot);
      await refreshSyncSummary(userData.user.id);
    } catch (error) {
      console.error(error);
      const cachedUser = await getCachedUser();
      if (cachedUser?.id) {
        try {
          await loadOfflineSnapshot(cachedUser.id);
          return;
        } catch {
          // Continue with the original error if no offline snapshot exists.
        }
      }
      const message = error instanceof Error ? error.message : "Nao foi possivel carregar os dados do Supabase.";
      setConfigurationError(message);
      toast.error(message);
      setState({ leads: [], interactions: [], tasks: [], templates: [], profiles: [] });
    } finally {
      setLoading(false);
    }
  }, [loadOfflineSnapshot, network.online, refreshSyncSummary]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    async function syncWhenOnline() {
      if (!network.online || !currentUserId || automaticSyncInProgress.current) return;
      automaticSyncInProgress.current = true;
      setSyncing(true);
      try {
        const result = await syncPendingOperations(currentUserId);
        if (result.synced > 0) {
          toast.success(`${result.synced} alteracao(oes) sincronizada(s).`);
          await refresh();
        } else {
          await refreshSyncSummary(currentUserId);
        }
        if (result.failed > 0) toast.error("Algumas alteracoes nao sincronizaram.");
      } finally {
        automaticSyncInProgress.current = false;
        setSyncing(false);
      }
    }

    void syncWhenOnline();
  }, [currentUserId, network.online, refresh, refreshSyncSummary]);

  React.useEffect(() => {
    function updateQueue() {
      void refreshSyncSummary();
    }

    window.addEventListener("novaforma:sync-queue-changed", updateQueue);
    return () => window.removeEventListener("novaforma:sync-queue-changed", updateQueue);
  }, [refreshSyncSummary]);

  async function syncNow() {
    if (!currentUserId) throw new Error("Usuario nao autenticado.");
    if (!network.online) {
      toast.error("Voce esta offline. Conecte-se para sincronizar.");
      return;
    }
    if (automaticSyncInProgress.current) return;
    automaticSyncInProgress.current = true;
    setSyncing(true);
    try {
      const result = await syncPendingOperations(currentUserId);
      await refresh();
      if (result.synced > 0) toast.success(`${result.synced} alteracao(oes) sincronizada(s).`);
      if (result.failed > 0) toast.error("Algumas alteracoes nao sincronizaram.");
    } finally {
      automaticSyncInProgress.current = false;
      setSyncing(false);
    }
  }

  async function retrySync() {
    if (!currentUserId) return;
    await retryFailedOperations(currentUserId);
    await syncNow();
  }

  async function saveLead(input: Partial<Lead> & Pick<Lead, "name" | "phone">) {
    const nextLead = normalizeLead(input);
    const isUpdate = state.leads.some((lead) => lead.id === nextLead.id);
    try {
      const userId = await getUserIdForWrite();
      const leadWithUser = { ...nextLead, user_id: userId };
      if (!network.online) {
        updateLocalState((current) => ({
          ...current,
          leads: [leadWithUser, ...current.leads.filter((lead) => lead.id !== leadWithUser.id)],
        }));
        await queueOfflineChange({ entity: "leads", entityId: leadWithUser.id, userId, operation: isUpdate ? "update" : "create", data: leadWithUser });
        return leadWithUser;
      }
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const payload = leadWithUser;
      const { data, error } = await supabase.from("leads").upsert(payload).select("*").single();
      if (error) throw error;
      toast.success("Lead salvo com sucesso.");
      await refresh();
      return data as Lead;
    } catch (error) {
      if (!network.online) throw error;
      const message = getErrorMessage(error, "Erro ao salvar lead.");
      console.error("Erro ao salvar lead:", message, error);
      toast.error(message);
      throw error;
    }
  }

  async function deleteLead(id: string) {
    try {
      const userId = await getUserIdForWrite();
      const lead = state.leads.find((item) => item.id === id);
      if (!network.online && lead) {
        updateLocalState((current) => ({ ...current, leads: current.leads.filter((item) => item.id !== id) }));
        await queueOfflineChange({ entity: "leads", entityId: id, userId, operation: "delete", data: lead });
        return;
      }
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

  async function addInteraction(
    leadId: string,
    input: Omit<Interaction, "id" | "lead_id" | "created_at">,
    leadUpdates: Partial<Pick<Lead, "status" | "priority">> = {},
  ) {
    const now = new Date().toISOString();
    try {
      const lead = state.leads.find((item) => item.id === leadId);
      if (!lead) throw new Error("Lead valido nao encontrado para registrar interacao.");
      const parsed = interactionSchema.parse(input);
      const interaction: Interaction = { ...parsed, id: uuid(), lead_id: leadId, created_at: now };
      const userId = await getUserIdForWrite();
      const interactionWithUser = { ...interaction, user_id: userId };
      const task = buildFollowUpTaskFromInteraction({ lead, leadId, interaction: parsed });
      const updatedLead = { ...lead, ...leadUpdates, last_contact_at: now, next_action_at: parsed.next_contact_at ?? lead.next_action_at, updated_at: now };

      if (!network.online) {
        updateLocalState((current) => ({
          ...current,
          interactions: [interactionWithUser, ...current.interactions],
          tasks: task ? [{ ...task, user_id: userId }, ...current.tasks] : current.tasks,
          leads: current.leads.map((item) => (item.id === leadId ? updatedLead : item)),
        }));
        await queueOfflineChange({ entity: "interactions", entityId: interaction.id, userId, operation: "create", data: interactionWithUser });
        await queueOfflineChange({ entity: "leads", entityId: leadId, userId, operation: "update", data: updatedLead });
        if (task) await putSyncedLocalRecord("tasks", { ...task, user_id: userId }, userId);
        return;
      }

      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { error } = await supabase.from("interactions").insert(interactionWithUser);
      if (error) throw error;

      const { error: leadError } = await supabase
        .from("leads")
        .update({ ...leadUpdates, last_contact_at: now, next_action_at: parsed.next_contact_at ?? lead.next_action_at, updated_at: now })
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
      const userId = await getUserIdForWrite();
      const updatedInteraction = { ...existing, ...parsed, user_id: existing.user_id ?? userId };

      if (!network.online) {
        updateLocalState((current) => ({
          ...current,
          interactions: current.interactions.map((item) => (item.id === id ? updatedInteraction : item)),
        }));
        await queueOfflineChange({ entity: "interactions", entityId: id, userId, operation: "update", data: updatedInteraction });
        return;
      }

      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");

      const { error } = await supabase.from("interactions").update(parsed).eq("id", id);
      if (error) throw error;

      const task = parsed.next_contact_at && !existing.next_contact_at ? buildFollowUpTaskFromInteraction({ lead, leadId: existing.lead_id, interaction: parsed }) : null;
      if (task) {
        const { error: taskError } = await supabase.from("tasks").insert({ ...task, user_id: userId });
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
      const userId = await getUserIdForWrite();
      const existing = state.interactions.find((item) => item.id === id);
      if (!network.online && existing) {
        updateLocalState((current) => ({ ...current, interactions: current.interactions.filter((item) => item.id !== id) }));
        await queueOfflineChange({ entity: "interactions", entityId: id, userId, operation: "delete", data: existing });
        return;
      }
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
      const userId = await getUserIdForWrite();
      const taskWithUser = { ...task, user_id: userId };
      const isUpdate = state.tasks.some((item) => item.id === task.id);
      if (!network.online) {
        updateLocalState((current) => ({
          ...current,
          tasks: [taskWithUser, ...current.tasks.filter((item) => item.id !== task.id)],
        }));
        await queueOfflineChange({ entity: "tasks", entityId: task.id, userId, operation: isUpdate ? "update" : "create", data: taskWithUser });
        return;
      }
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { error } = await supabase.from("tasks").upsert(taskWithUser);
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
      const userId = await getUserIdForWrite();
      const tasksWithUser = tasks.map((task) => ({ ...task, user_id: userId }));
      if (!network.online) {
        updateLocalState((current) => ({ ...current, tasks: [...tasksWithUser, ...current.tasks] }));
        for (const task of tasksWithUser) {
          await queueOfflineChange({ entity: "tasks", entityId: task.id, userId, operation: "create", data: task });
        }
        return;
      }
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { error } = await supabase.from("tasks").insert(tasksWithUser);
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
      const userId = await getUserIdForWrite();
      const task = state.tasks.find((item) => item.id === id);
      if (!network.online && task) {
        updateLocalState((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== id) }));
        await queueOfflineChange({ entity: "tasks", entityId: id, userId, operation: "delete", data: task });
        return;
      }
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
      const userId = await getUserIdForWrite();
      const templateWithUser = { ...template, user_id: userId };
      const isUpdate = state.templates.some((item) => item.id === template.id);
      if (!network.online) {
        updateLocalState((current) => ({
          ...current,
          templates: [templateWithUser, ...current.templates.filter((item) => item.id !== template.id)],
        }));
        await queueOfflineChange({ entity: "message_templates", entityId: template.id, userId, operation: isUpdate ? "update" : "create", data: templateWithUser });
        return;
      }
      if (!isSupabaseConfigured || !supabase) throw new Error("Supabase nao configurado.");
      const { error } = await supabase.from("message_templates").upsert(templateWithUser);
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
      const userId = await getUserIdForWrite();
      const template = state.templates.find((item) => item.id === id);
      if (!network.online && template) {
        updateLocalState((current) => ({ ...current, templates: current.templates.filter((item) => item.id !== id) }));
        await queueOfflineChange({ entity: "message_templates", entityId: id, userId, operation: "delete", data: template });
        return;
      }
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
    const userId = currentUserId;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    if (userId) await clearOfflineDbForUser(userId);
    clearPrivateRuntimeCache();
    setUserEmail(null);
    setCurrentUserId(null);
    setCurrentProfile(null);
    setSyncSummary({ pending: 0, failed: 0, conflict: 0, operations: [] });
    setState({ leads: [], interactions: [], tasks: [], templates: [], profiles: [] });
    toast.success("Sessao encerrada.");
  }

  async function updatePartnerVisit(
    leadId: string,
    input: Pick<Lead, "visit_status" | "partner_notes" | "partner_visit_feedback">,
  ) {
    try {
      const userId = await getUserIdForWrite();
      const lead = state.leads.find((item) => item.id === leadId);
      const updatedLead = lead ? { ...lead, ...input, updated_at: new Date().toISOString() } : null;
      if (!network.online && updatedLead) {
        updateLocalState((current) => ({ ...current, leads: current.leads.map((item) => (item.id === leadId ? updatedLead : item)) }));
        await queueOfflineChange({
          entity: "leads",
          entityId: leadId,
          userId,
          operation: "update",
          data: updatedLead,
          syncMode: "partner_visit_feedback",
        });
        return;
      }
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
    currentUserId,
    configurationError,
    isOnline: network.online,
    syncing,
    syncSummary,
    syncNow,
    retrySync,
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
