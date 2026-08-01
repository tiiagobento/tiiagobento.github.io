import fs from "node:fs";
import path from "node:path";

const timeoutMs = 15_000;
const baselineTables = [
  "profiles",
  "leads",
  "interactions",
  "tasks",
  "message_templates",
  "permissions",
  "role_permissions",
  "user_permission_overrides",
  "admin_audit_log",
  "partner_notifications",
  "partner_commissions",
  "lead_files",
  "push_device_tokens",
  "push_notification_deliveries",
  "steel_frame_estimates",
  "steel_frame_estimate_versions",
  "steel_frame_suppliers",
  "steel_frame_materials",
  "steel_frame_material_prices",
  "steel_frame_documents",
  "steel_frame_wall_segments",
  "steel_frame_openings",
  "steel_frame_reinforcement_templates",
  "steel_frame_technical_rules",
  "steel_frame_technical_compositions",
  "steel_frame_technical_composition_rules",
  "steel_frame_technical_assessments",
  "steel_frame_audit_logs",
];

const baselineSources = {
  profiles: "supabase/schema.sql",
  leads: "supabase/schema.sql",
  interactions: "supabase/schema.sql",
  tasks: "supabase/schema.sql",
  message_templates: "supabase/schema.sql",
  permissions: "supabase/migrations/add_access_control.sql",
  role_permissions: "supabase/migrations/add_access_control.sql",
  user_permission_overrides: "supabase/migrations/add_access_control.sql",
  admin_audit_log: "supabase/migrations/add_access_control.sql",
  partner_notifications: "supabase/migrations/add_partner_notifications.sql",
  partner_commissions: "supabase/migrations/add_partner_commissions_and_lead_files.sql",
  lead_files: "supabase/migrations/add_partner_commissions_and_lead_files.sql",
  push_device_tokens: "supabase/migrations/add_push_notifications.sql",
  push_notification_deliveries: "supabase/migrations/add_push_notifications.sql",
  steel_frame_estimates: "supabase/migrations/add_steel_frame_estimates.sql",
  steel_frame_estimate_versions: "supabase/migrations/add_steel_frame_estimates.sql",
  steel_frame_suppliers: "supabase/migrations/add_steel_frame_estimates.sql",
  steel_frame_materials: "supabase/migrations/add_steel_frame_estimates.sql",
  steel_frame_material_prices: "supabase/migrations/add_steel_frame_estimates.sql",
  steel_frame_documents: "supabase/migrations/add_steel_frame_estimates.sql",
  steel_frame_wall_segments: "supabase/migrations/add_steel_frame_estimates.sql",
  steel_frame_openings: "supabase/migrations/add_steel_frame_estimates.sql",
  steel_frame_reinforcement_templates: "supabase/migrations/add_steel_frame_estimates.sql",
  steel_frame_technical_rules: "supabase/migrations/add_steel_frame_technical_rules.sql",
  steel_frame_technical_compositions: "supabase/migrations/add_steel_frame_technical_rules.sql",
  steel_frame_technical_composition_rules: "supabase/migrations/add_steel_frame_technical_rules.sql",
  steel_frame_technical_assessments: "supabase/migrations/add_steel_frame_technical_rules.sql",
  steel_frame_audit_logs: "supabase/migrations/add_steel_frame_estimates.sql",
};

const knownBuckets = ["lead-files", "steel-frame-documents", "steel-frame-catalog"];

const tableProbeColumns = {
  permissions: "key",
  role_permissions: "permission_key",
  user_permission_overrides: "user_id",
};

function readEnvironment(filePath) {
  const values = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function projectRefFromUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    const match = hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function readEndpoint(baseUrl, requestPath, headers) {
  try {
    const response = await fetch(`${baseUrl}${requestPath}`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Only response metadata is included in the report.
    }

    return {
      status: response.status,
      code: typeof body?.code === "string" ? body.code : null,
    };
  } catch (error) {
    return {
      status: null,
      code: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error",
    };
  }
}

async function listBuckets(baseUrl, headers) {
  try {
    const response = await fetch(`${baseUrl}/storage/v1/bucket`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.json().catch(() => null);
    return {
      status: response.status,
      code: typeof body?.code === "string" ? body.code : null,
      buckets: Array.isArray(body)
        ? body.map((bucket) => ({ id: String(bucket.id), public: Boolean(bucket.public) })).sort((a, b) => a.id.localeCompare(b.id))
        : [],
    };
  } catch (error) {
    return {
      status: null,
      code: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error",
      buckets: [],
    };
  }
}

async function inspectKnownBuckets(baseUrl, headers) {
  return Object.fromEntries(
    await Promise.all(
      knownBuckets.map(async (bucket) => [bucket, await readEndpoint(baseUrl, `/storage/v1/bucket/${bucket}`, headers)]),
    ),
  );
}

const environmentPath = path.resolve(process.cwd(), process.argv[2] ?? ".env.local");
if (!fs.existsSync(environmentPath)) {
  console.error(JSON.stringify({ error: "Arquivo de ambiente local nao encontrado.", file: path.basename(environmentPath) }));
  process.exitCode = 1;
} else {
  const environment = readEnvironment(environmentPath);
  const baseUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!baseUrl || !publishableKey) {
    console.error(JSON.stringify({
      error: "NEXT_PUBLIC_SUPABASE_URL e uma chave publica do Supabase sao obrigatorias para o diagnostico.",
      file: path.basename(environmentPath),
      urlConfigured: Boolean(baseUrl),
      publishableKeyConfigured: Boolean(publishableKey),
    }));
    process.exitCode = 1;
  } else {
    const headers = {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      Prefer: "count=exact",
    };
    const tableResults = await Promise.all(
      baselineTables.map(async (table) => [
        table,
        await readEndpoint(baseUrl, `/rest/v1/${table}?select=${tableProbeColumns[table] ?? "id"}&limit=0`, headers),
      ]),
    );
    const tableStatus = Object.fromEntries(tableResults);
    const [buckets, knownBucketStatus, authSettings, restRoot] = await Promise.all([
      listBuckets(baseUrl, headers),
      inspectKnownBuckets(baseUrl, headers),
      readEndpoint(baseUrl, "/auth/v1/settings", headers),
      readEndpoint(baseUrl, "/rest/v1/", headers),
    ]);

    const foundTables = baselineTables.filter((table) => tableStatus[table].status === 200);
    const missingTables = baselineTables.filter((table) => tableStatus[table].code === "PGRST205" || tableStatus[table].status === 404);
    const inaccessibleTables = baselineTables.filter((table) => !foundTables.includes(table) && !missingTables.includes(table));
    const inaccessibleTableStatus = Object.fromEntries(
      inaccessibleTables.map((table) => [table, tableStatus[table]]),
    );
    const repairHints = Object.entries(
      missingTables.reduce((sources, table) => {
        const source = baselineSources[table];
        sources[source] = [...(sources[source] ?? []), table];
        return sources;
      }, {}),
    ).map(([source, tables]) => ({ source, tables }));

    console.log(JSON.stringify({
      mode: "read_only",
      environmentFile: path.basename(environmentPath),
      api: {
        host: new URL(baseUrl).hostname,
        projectRef: projectRefFromUrl(baseUrl),
        publicKeyConfigured: true,
        serviceRoleConfigured: Boolean(environment.SUPABASE_SERVICE_ROLE_KEY),
      },
      endpoints: {
        authSettings,
        restRoot,
        storage: { ...buckets, knownBucketStatus },
      },
      baseline: {
        expectedTableCount: baselineTables.length,
        foundTables,
        missingTables,
        inaccessibleTables,
        inaccessibleTableStatus,
        repairHints,
        classification: foundTables.length === 0
          ? "empty_or_inaccessible"
          : missingTables.length > 0
            ? "partial_or_incompatible"
            : "schema_surface_complete",
      },
      notes: [
        "O diagnostico usa somente requisicoes GET e nao le linhas de negocio.",
        "Uma resposta 200 confirma apenas que a tabela esta exposta pelo endpoint; RLS, policies, triggers e ownership exigem o preflight SQL autenticado.",
        "A classificacao nao identifica producao ou homologacao por si so.",
      ],
    }, null, 2));
  }
}
