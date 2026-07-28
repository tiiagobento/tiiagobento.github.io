"use client";

import { AccessManagement } from "@/components/access-management";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useCrmData } from "@/hooks/use-crm-data";

export default function UsersAndAccessPage() {
  const { profiles, leads, currentProfile, loading, refresh } = useCrmData();
  if (loading) return <LoadingSkeleton />;
  return <AccessManagement profiles={profiles} leads={leads} currentProfile={currentProfile} onChanged={refresh} />;
}
