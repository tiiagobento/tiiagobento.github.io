import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "supabase/schema.sql"), "utf8");
const partnerNotificationsMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/add_partner_notifications.sql"), "utf8");
const accessControlMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/add_access_control.sql"), "utf8");
const pushNotificationsMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/add_push_notifications.sql"), "utf8");

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
