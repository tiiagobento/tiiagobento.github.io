import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "supabase/schema.sql"), "utf8");
const partnerNotificationsMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/add_partner_notifications.sql"), "utf8");
const accessControlMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/add_access_control.sql"), "utf8");
const permissionAuditMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/add_permission_audit_details.sql"), "utf8");
const pushNotificationsMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/add_push_notifications.sql"), "utf8");
const primaryAdminMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/ensure_primary_admin.sql"), "utf8");
const partnerCommissionsMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/add_partner_commissions_and_lead_files.sql"), "utf8");
const steelFrameEstimatesMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/add_steel_frame_estimates.sql"),
  "utf8",
);
const steelFrameTechnicalRulesMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/add_steel_frame_technical_rules.sql"),
  "utf8",
);

function getSteelFrameTriggerTargets(triggerSuffix: string) {
  const markerIndex = steelFrameEstimatesMigration.indexOf(`target_table || '${triggerSuffix}'`);
  const loopStart = steelFrameEstimatesMigration.lastIndexOf("foreach target_table in array array[", markerIndex);
  const targetsStart = steelFrameEstimatesMigration.indexOf("[", loopStart);
  const targetsEnd = steelFrameEstimatesMigration.indexOf("] loop", targetsStart);

  return steelFrameEstimatesMigration.slice(targetsStart, targetsEnd);
}

describe("Supabase interaction follow-up trigger", () => {
  it("creates the follow-up task after a new interaction with a next contact", () => {
    expect(schema).toContain("create or replace function public.after_interaction_insert()");
    expect(schema).toContain("if new.next_contact_at is not null then");
    expect(schema).toContain("insert into public.tasks");
    expect(schema).toContain("create trigger interactions_after_insert after insert on public.interactions");
  });
});

describe("Supabase partner briefing notifications", () => {
  it("creates a recipient-scoped notification when a partner briefing is assigned or updated", () => {
    expect(schema).toContain("create table if not exists public.partner_notifications");
    expect(schema).toContain("alter table public.partner_notifications enable row level security");
    expect(schema).toContain("create policy \"partner_notifications_select_recipient_or_admin\"");
    expect(schema).toContain("create or replace function public.notify_partner_visit_briefing()");
    expect(schema).toContain("create trigger leads_notify_partner_visit_briefing");
  });

  it("grants authenticated users table access while leaving row filtering to RLS", () => {
    expect(schema).toContain("grant select, insert, update, delete on table public.profiles, public.leads, public.interactions, public.tasks, public.message_templates to authenticated;");
    expect(schema).toContain("grant select, update on table public.partner_notifications to authenticated;");
  });

  it("keeps the incremental migration additive and non-destructive", () => {
    expect(partnerNotificationsMigration).toContain("create table if not exists public.partner_notifications");
    expect(partnerNotificationsMigration).not.toMatch(/drop\s+table|truncate\s+table|delete\s+from/i);
  });
});

describe("Supabase access control migration", () => {
  it("adds roles, granular permissions and an audit trail without deleting CRM data", () => {
    expect(accessControlMigration).toContain("create table if not exists public.permissions");
    expect(accessControlMigration).toContain("create table if not exists public.user_permission_overrides");
    expect(accessControlMigration).toContain("create table if not exists public.admin_audit_log");
    expect(accessControlMigration).toContain("create function public.admin_update_user_access");
    expect(accessControlMigration).toContain("requested_name text default null");
    expect(accessControlMigration).toContain("O ultimo administrador ativo nao pode ser removido ou desativado");
    expect(accessControlMigration).not.toMatch(/drop\s+table|truncate\s+table|delete\s+from\s+public\.(leads|profiles|tasks|interactions)/i);
  });

  it("uses recipient-scoped partner notifications and blocks self-escalation", () => {
    expect(accessControlMigration).toContain("auth.uid() = user_id or public.has_permission('notifications.view_all')");
    expect(accessControlMigration).toContain("public.current_profile_is_active() and auth.uid() = user_id");
    expect(accessControlMigration).toContain("Nao e permitido alterar o proprio papel ou estado de acesso");
    expect(accessControlMigration).toContain("Permissao insuficiente para atribuir parceiro");
  });

  it("keeps AI and WhatsApp actions behind explicit permissions", () => {
    expect(accessControlMigration).toContain("('whatsapp.open'");
    expect(accessControlMigration).toContain("('ai.generate'");
    expect(accessControlMigration).toContain("('ai.import'");
    expect(accessControlMigration).toContain("('ai.daily_plan'");
  });

  it("can be applied again without duplicate-policy failures", () => {
    expect(accessControlMigration).toContain('drop policy if exists "leads_select_authorized"');
    expect(accessControlMigration).toContain('drop policy if exists "partner_notifications_select_authorized"');
    expect(accessControlMigration).toContain('drop policy if exists "permissions_select_authenticated"');
  });

  it("records granted and revoked permission overrides in the administrative audit", () => {
    expect(permissionAuditMigration).toContain("create or replace function public.admin_update_user_access");
    expect(permissionAuditMigration).toContain("'permission_overrides', previous_overrides");
    expect(permissionAuditMigration).toContain("'permission_overrides', applied_overrides");
  });
});

describe("Supabase Android push notification migration", () => {
  it("keeps device tokens recipient-scoped and queues partner activity without deleting CRM data", () => {
    expect(pushNotificationsMigration).toContain("create table if not exists public.push_device_tokens");
    expect(pushNotificationsMigration).toContain("create table if not exists public.push_notification_deliveries");
    expect(pushNotificationsMigration).toContain("enable row level security");
    expect(pushNotificationsMigration).toContain("create policy \"push_device_tokens_select_own\"");
    expect(pushNotificationsMigration).toContain("create or replace function public.register_push_device_token");
    expect(pushNotificationsMigration).toContain("create trigger partner_notifications_enqueue_push");
    expect(pushNotificationsMigration).toContain("partner_feedback_received");
    expect(pushNotificationsMigration).toContain("status in ('pending', 'sending', 'sent', 'failed', 'skipped')");
    expect(pushNotificationsMigration).not.toMatch(/drop\s+table|truncate\s+table|delete\s+from\s+public\.(leads|profiles|tasks|interactions)/i);
  });
});

describe("Supabase primary admin bootstrap", () => {
  it("keeps Tiago's account administrative without deleting CRM data", () => {
    expect(primaryAdminMigration).toContain("tiagov.bento@gmail.com");
    expect(primaryAdminMigration).toContain("create or replace function public.is_primary_admin()");
    expect(primaryAdminMigration).toContain("create or replace function public.current_profile_role()");
    expect(primaryAdminMigration).toContain("insert into public.profiles");
    expect(primaryAdminMigration).toContain("role = 'admin'");
    expect(schema).toContain("create or replace function public.primary_admin_email()");
    expect(schema).toContain("tiagov.bento@gmail.com");
    expect(primaryAdminMigration).not.toMatch(/drop\s+table|truncate\s+table|delete\s+from\s+public\.(leads|profiles|tasks|interactions)/i);
  });
});

describe("Supabase partner commission and lead files migration", () => {
  it("keeps the 5% commission workflow and private attachment storage additive", () => {
    expect(partnerCommissionsMigration).toContain("create table if not exists public.partner_commissions");
    expect(partnerCommissionsMigration).toContain("commission_rate numeric(5, 4) not null default 0.0500");
    expect(partnerCommissionsMigration).toContain("new.commission_amount := round(new.sale_amount * new.commission_rate, 2)");
    expect(partnerCommissionsMigration).toContain("create or replace function public.partner_submit_sale_commission");
    expect(partnerCommissionsMigration).toContain("create or replace function public.admin_confirm_partner_commission");
    expect(partnerCommissionsMigration).toContain("create table if not exists public.lead_files");
    expect(partnerCommissionsMigration).toContain("insert into storage.buckets");
    expect(partnerCommissionsMigration).toContain("create policy \"lead_files_storage_select_authorized\"");
    expect(partnerCommissionsMigration).toContain("partner_visit_completed");
    expect(partnerCommissionsMigration).not.toMatch(/drop\s+table|truncate\s+table|delete\s+from\s+public\.(leads|profiles|tasks|interactions)/i);
  });
});

describe("Supabase Steel Frame estimates migration", () => {
  it("creates the estimate domain without deleting existing CRM records", () => {
    expect(steelFrameEstimatesMigration).toContain("create table if not exists public.steel_frame_estimates");
    expect(steelFrameEstimatesMigration).toContain("create table if not exists public.steel_frame_estimate_versions");
    expect(steelFrameEstimatesMigration).toContain("create table if not exists public.steel_frame_documents");
    expect(steelFrameEstimatesMigration).toContain("create table if not exists public.steel_frame_ai_analysis_jobs");
    expect(steelFrameEstimatesMigration).toContain("create table if not exists public.steel_frame_calculated_items");
    expect(steelFrameEstimatesMigration).toContain("create or replace function public.create_steel_frame_estimate");
    expect(steelFrameEstimatesMigration).toContain("create or replace function public.create_steel_frame_material");
    expect(steelFrameEstimatesMigration).toContain("create or replace function public.approve_steel_frame_estimate");
    expect(steelFrameEstimatesMigration).toContain("lead_id uuid references public.leads(id) on delete set null");
    expect(steelFrameEstimatesMigration).not.toMatch(
      /drop\s+table|truncate\s+table|delete\s+from\s+public\.(leads|profiles|tasks|interactions)/i,
    );
  });

  it("enables RLS, keeps estimate files private, and limits financial data", () => {
    expect(steelFrameEstimatesMigration).toContain("enable row level security");
    expect(steelFrameEstimatesMigration).toContain("public.can_access_steel_frame_estimate");
    expect(steelFrameEstimatesMigration).toContain("public.can_read_steel_frame_financials");
    expect(steelFrameEstimatesMigration).toContain("'steel-frame-documents'");
    expect(steelFrameEstimatesMigration).toContain("public = false");
    expect(steelFrameEstimatesMigration).toContain("estimates.view_assigned");
    expect(steelFrameEstimatesMigration).toContain("steel_frame_documents_delete_authorized");
    expect(steelFrameEstimatesMigration).toContain("can_generate_steel_frame_proposal");
    expect(steelFrameEstimatesMigration).toContain("is_current_steel_frame_estimate_version");
    expect(steelFrameEstimatesMigration).toContain("mark_steel_frame_proposal_generated");
    expect(steelFrameEstimatesMigration).toContain("document_type = 'proposal'");
    expect(steelFrameEstimatesMigration).toContain("visibility = 'internal'");
  });

  it("audits changes and protects approved versions from later mutation", () => {
    expect(steelFrameEstimatesMigration).toContain("audit_steel_frame_estimate_change");
    expect(steelFrameEstimatesMigration).toContain("guard_steel_frame_version_mutation");
    expect(steelFrameEstimatesMigration).toContain("guard_steel_frame_version_content_mutation");
    expect(steelFrameEstimatesMigration).toContain("assign_steel_frame_current_version");
    expect(steelFrameEstimatesMigration).toContain("set_steel_frame_updated_at");
  });

  it("only assigns and guards versioned child records", () => {
    const assignCurrentVersionTargets = getSteelFrameTriggerTargets("_assign_current_version");
    const updatedAtTargets = getSteelFrameTriggerTargets("_updated_at");
    const versionGuardTargets = getSteelFrameTriggerTargets("_version_guard");

    expect(assignCurrentVersionTargets).toContain("'steel_frame_documents'");
    expect(assignCurrentVersionTargets).not.toContain("'steel_frame_ai_extractions'");
    expect(updatedAtTargets).toContain("'steel_frame_ai_extractions'");
    expect(versionGuardTargets).toContain("'steel_frame_ai_questions'");
    expect(versionGuardTargets).not.toContain("'steel_frame_ai_extractions'");
  });

  it("keeps one current commercial component per estimate for safe upserts", () => {
    expect(steelFrameEstimatesMigration).toContain(
      "unique nulls not distinct (estimate_id, estimate_version_id, component_key)",
    );
  });
});

describe("Supabase Steel Frame technical rules migration", () => {
  it("adds versioned technical artefacts without creating or deleting commercial data", () => {
    expect(steelFrameTechnicalRulesMigration).toContain("create table if not exists public.steel_frame_technical_rules");
    expect(steelFrameTechnicalRulesMigration).toContain("create table if not exists public.steel_frame_technical_compositions");
    expect(steelFrameTechnicalRulesMigration).toContain("create table if not exists public.steel_frame_technical_assessments");
    expect(steelFrameTechnicalRulesMigration).toContain("unique (code, version)");
    expect(steelFrameTechnicalRulesMigration).not.toMatch(/drop\s+table|truncate\s+table|delete\s+from\s+public\.(leads|profiles|tasks|interactions)/i);
  });

  it("keeps approvals explicit, protects approved versions, and enables RLS", () => {
    expect(steelFrameTechnicalRulesMigration).toContain("Modelos e regras tecnicas devem ser criados como rascunho");
    expect(steelFrameTechnicalRulesMigration).toContain("Crie uma nova versao");
    expect(steelFrameTechnicalRulesMigration).toContain("approve_steel_frame_technical_rule");
    expect(steelFrameTechnicalRulesMigration).toContain("approve_steel_frame_technical_composition");
    expect(steelFrameTechnicalRulesMigration).toContain("steel_frame_technical_rules_select_authorized");
    expect(steelFrameTechnicalRulesMigration).toContain("status = 'approved' and public.can_view_steel_frame_catalog()");
    expect(steelFrameTechnicalRulesMigration).toContain("steel_frame_technical_assessments_insert_authorized");
    expect(steelFrameTechnicalRulesMigration).toContain("public.can_edit_steel_frame_estimate(estimate_id)");
  });
});
