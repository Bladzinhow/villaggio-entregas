// Edge Function: scan-label
// Recebe uma foto da etiqueta da encomenda (em base64) e usa a IA da
// Anthropic (Claude) para tentar ler o código de rastreio, o nome do
// destinatário e a transportadora. Não depende de login — pode ser
// chamada tanto da tela interna da portaria quanto da tela pública do
// entregador (/nova).
//
// Precisa de um segredo ANTHROPIC_API_KEY configurado em:
// Supabase → Edge Functions → scan-label → Secrets
// (veja o passo a passo e a estimativa de custo no README, Parte 13)

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CARRIERS = ["Shopee", "Mercado Livre", "Amazon", "Correios", "Transportadora", "Outro"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return json({ ok: false, reason: "ai_not_configured" }, 200);
  }

  try {
    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64) {
      return json({ ok: false, reason: "missing_image" }, 400);
    }

    const prompt = `Você está vendo a foto de uma etiqueta de uma encomenda/pacote entregue em um condomínio
residencial no Brasil. Extraia o que conseguir identificar e responda SOMENTE com um JSON válido,
sem nenhum texto antes ou depois, no formato exato:

{
  "tracking_code": "string ou null — o código de rastreio/postagem (geralmente alfanumérico, ex: BR123456789BR)",
  "recipient_name": "string ou null — nome da pessoa destinatária, se estiver visível",
  "street": "string ou null — nome da rua do endereço de entrega, se estiver visível",
  "house_number": "string ou null — número da casa/unidade, se estiver visível",
  "carrier": "um destes valores, o que mais combinar com o que está escrito/logotipo na etiqueta: ${CARRIERS.join(", ")} — use null se não tiver certeza"
}

Se não conseguir ler algum campo com confiança, use null nesse campo em vez de inventar um valor.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: imageBase64,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return json({ ok: false, reason: "anthropic_error", detail: errText }, 200);
    }

    const data = await resp.json();
    const text = data?.content?.[0]?.text || "";

    let parsed;
    try {
      // A IA às vezes envolve o JSON em crases (```json ... ```) mesmo quando
      // pedimos para não fazer isso — removemos antes de tentar interpretar.
      const cleaned = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return json({ ok: false, reason: "could_not_parse", raw: text }, 200);
    }

    return json({ ok: true, data: parsed });
  } catch (err) {
    return json({ ok: false, reason: "unexpected_error", detail: String(err) }, 200);
  }
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
