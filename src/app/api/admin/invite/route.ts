import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  name: z.string().trim().max(120).optional().default(""),
});

export async function POST(request: Request) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json({ error: "Convites nao estao configurados no servidor. Configure SUPABASE_SERVICE_ROLE_KEY somente no ambiente de backend." }, { status: 503 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });

    const { data: canManage, error: permissionError } = await supabase.rpc("has_permission", { permission_name: "users.manage" });
    if (permissionError || !canManage) return NextResponse.json({ error: "Voce nao possui permissao para convidar usuarios." }, { status: 403 });

    const body = inviteSchema.parse(await request.json());
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, {
      data: { name: body.name || undefined },
      redirectTo: new URL("/login", request.url).origin,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await admin.from("admin_audit_log").insert({
      actor_id: user.id,
      subject_user_id: data.user.id,
      action: "user.invited",
      new_values: { email: body.email, name: body.name || null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Convite invalido." }, { status: 400 });
    return NextResponse.json({ error: "Nao foi possivel enviar o convite." }, { status: 500 });
  }
}
