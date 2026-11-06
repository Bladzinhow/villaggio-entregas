// Edge Function: notify-arrival
// Envia um e-mail automático ao morador quando uma encomenda chega na
// portaria. Chamada pelo app logo depois de cadastrar/aceitar uma
// encomenda. Se não houver e-mail cadastrado para o morador, ou se o
// envio falhar, simplesmente não faz nada — nunca trava o cadastro.
//
// Precisa de um segredo RESEND_API_KEY configurado em:
// Supabase → Edge Functions → notify-arrival → Secrets
// (veja o passo a passo no README, Parte 13)

import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("NOTIFY_FROM_EMAIL") || "onboarding@resend.dev";
const SITE_URL = Deno.env.get("SITE_URL") || "https://entregas-villaggio.vercel.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { packageId } = await req.json();
    if (!packageId) {
      return json({ sent: false, reason: "missing_package_id" }, 400);
    }

    // Usa o token de quem chamou (um porteiro/síndico já logado) para
    // ler os dados respeitando as mesmas permissões do app.
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: pkg, error: pkgError } = await supabase
      .from("packages")
      .select("id, recipient_name, street, house_number, carrier, pickup_token")
      .eq("id", packageId)
      .single();

    if (pkgError || !pkg) {
      return json({ sent: false, reason: "package_not_found" }, 404);
    }

    const { data: residents } = await supabase
      .from("residents")
      .select("email, full_name")
      .ilike("street", pkg.street)
      .eq("house_number", pkg.house_number || "");

    const resident = (residents || []).find((r) => r.email && r.email.trim());
    if (!resident) {
      return json({ sent: false, reason: "no_email_on_file" });
    }

    const { data: settings } = await supabase
      .from("app_settings")
      .select("custom_message")
      .eq("id", true)
      .single();

    if (!RESEND_API_KEY) {
      return json({ sent: false, reason: "resend_not_configured" });
    }

    const pickupLink = `${SITE_URL}/retirar?token=${pkg.pickup_token}`;
    const extra = settings?.custom_message ? `<p>${escapeHtml(settings.custom_message)}</p>` : "";

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1B2A41;">📦 Chegou uma encomenda para você!</h2>
        <p>Olá, ${escapeHtml(resident.full_name || "")}!</p>
        <p>Uma encomenda da <strong>${escapeHtml(pkg.carrier || "")}</strong> chegou na portaria do
        Villaggio Paradiso para <strong>${escapeHtml(pkg.recipient_name)}</strong>
        (${escapeHtml(pkg.street)}${pkg.house_number ? ", " + escapeHtml(pkg.house_number) : ""}).</p>
        ${extra}
        <p>
          <a href="${pickupLink}" style="background:#1B2A41;color:#fff;padding:10px 18px;
          border-radius:8px;text-decoration:none;display:inline-block;">
            Confirmar que já retirei
          </a>
        </p>
        <p style="color:#777;font-size:13px;">Esse link é só seu — use quando retirar a encomenda na portaria.</p>
      </div>
    `;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Villaggio Paradiso <${FROM_EMAIL}>`,
        to: [resident.email],
        subject: "📦 Chegou uma encomenda para você",
        html,
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      return json({ sent: false, reason: "resend_error", detail: errText }, 200);
    }

    return json({ sent: true });
  } catch (err) {
    return json({ sent: false, reason: "unexpected_error", detail: String(err) }, 200);
  }
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
