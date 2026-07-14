"use client";

import { DashboardView } from "@/components/dashboard-view";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useAutomationLevel } from "@/hooks/use-automation-level";
import { useCrmData } from "@/hooks/use-crm-data";

export default function DashboardPage() {
  const crm = useCrmData();
  const { leads, interactions, tasks, templates, currentProfile, currentUserId, isOnline, loading } = crm;
  const [automationLevel] = useAutomationLevel(currentUserId);
  if (loading) return <LoadingSkeleton />;
  return (
    <DashboardView
      leads={leads}
      interactions={interactions}
      tasks={tasks}
      templates={templates}
      profileName={currentProfile?.name}
      isOnline={isOnline}
      automationLevel={automationLevel}
      handlers={{
        completeTask: crm.completeTask,
        saveTask: crm.saveTask,
        addInteraction: crm.addInteraction,
        updateLead: crm.updateLead,
      }}
    />
  );
}
