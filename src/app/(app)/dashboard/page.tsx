"use client";

import { DashboardView } from "@/components/dashboard-view";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useCrmData } from "@/hooks/use-crm-data";

export default function DashboardPage() {
  const { leads, interactions, tasks, loading } = useCrmData();
  if (loading) return <LoadingSkeleton />;
  return <DashboardView leads={leads} interactions={interactions} tasks={tasks} />;
}
