import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";

// Verifica se já existe uma encomenda cadastrada com o mesmo código de
// rastreio. Retorna o registro existente (para mostrar contexto no aviso)
// ou null se não houver duplicidade. Códigos vazios nunca são considerados.
export async function findDuplicateTracking(trackingCode, excludeId = null) {
  const code = (trackingCode || "").trim();
  if (!code) return null;

  let query = supabase
    .from("packages")
    .select("id, recipient_name, street, house_number, status, received_at")
    .ilike("tracking_code", code)
    .limit(1);

  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;

  if (error || !data || data.length === 0) return null;
  return data[0];
}

// Quantos dias inteiros já se passaram desde uma data (usado para alertar
// encomendas paradas há muito tempo na portaria).
export function daysSince(dateString) {
  if (!dateString) return 0;
  const ms = Date.now() - new Date(dateString).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Mantido só como valor de reserva (ex.: antes das configurações carregarem).
// O valor que realmente vale é o configurado pelo síndico em app_settings.
export const AGING_THRESHOLD_DAYS = 7;

// ------------------------------------------------------------
// Configurações do síndico (app_settings) — linha única na tabela.
// ------------------------------------------------------------
const DEFAULT_SETTINGS = {
  aging_alert_days: 7,
  aging_expire_days: 30,
  custom_message: "",
  notify_email_enabled: false,
  ai_scan_enabled: false,
};

export async function getSettings() {
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", true).single();
  if (error || !data) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...data };
}

export async function updateSettings(changes) {
  const { error } = await supabase.from("app_settings").update(changes).eq("id", true);
  return !error;
}

// Dispara o e-mail automático de chegada (se estiver ligado nas
// configurações). Nunca lança erro — se a função não estiver configurada
// ou a internet falhar, simplesmente não notifica, sem travar o cadastro.
export async function notifyArrival(packageId) {
  try {
    const { error } = await supabase.functions.invoke("notify-arrival", {
      body: { packageId },
    });
    return !error;
  } catch {
    return false;
  }
}

export function buildPickupLink(token) {
  return `${window.location.origin}/retirar?token=${token}`;
}

// ------------------------------------------------------------
// Leitura de etiqueta por IA ("Smart Scan").
// Recebe um arquivo de imagem, chama o Edge Function scan-label e
// devolve os campos que a IA conseguiu identificar (ou lança erro
// com uma mensagem amigável para mostrar na tela).
// ------------------------------------------------------------
export async function scanLabelWithAI(file) {
  const { base64, mediaType } = await fileToBase64(file);

  // Nunca espera para sempre: se a conexão travar, desiste depois de 20s
  // em vez de prender a pessoa na tela de carregamento.
  const invokePromise = supabase.functions.invoke("scan-label", {
    body: { imageBase64: base64, mediaType },
  });
  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve({ data: null, error: { message: "timeout" } }), 20000)
  );
  const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

  if (error) throw new Error("Não foi possível conectar ao leitor de IA. Tente novamente.");
  if (!data?.ok) {
    if (data?.reason === "ai_not_configured") {
      throw new Error("O leitor por IA ainda não foi configurado pelo síndico.");
    }
    throw new Error("Não consegui ler essa etiqueta. Tente outra foto ou preencha manualmente.");
  }
  return data.data; // { tracking_code, recipient_name, street, house_number, carrier }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // "data:image/jpeg;base64,AAAA..."
      const [header, base64] = result.split(",");
      const mediaType = header.match(/data:(.*);base64/)?.[1] || "image/jpeg";
      resolve({ base64, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const BUSINESS_HOURS_LABEL = "Segunda a sexta, 7h às 18h · Sábado, 7h às 14h";

// Confere se agora (no horário de Brasília, independente do fuso do
// aparelho de quem está acessando) está dentro do horário de atendimento.
// Isso é só para dar uma mensagem amigável na tela — a proteção real
// e definitiva está na regra do banco de dados (RLS), que recusa o
// cadastro fora desse horário mesmo que alguém tente burlar a tela.
export function isWithinBusinessHours(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);

  const weekdayStr = parts.find((p) => p.type === "weekday")?.value;
  let hour = parseInt(parts.find((p) => p.type === "hour")?.value, 10);
  if (hour === 24) hour = 0;

  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[weekdayStr];

  if (day >= 1 && day <= 5) return hour >= 7 && hour < 18;
  if (day === 6) return hour >= 7 && hour < 14;
  return false; // domingo
}

// Envia uma foto para o Supabase Storage e devolve o link público.
// Se der qualquer problema (sem internet, arquivo grande demais, etc.),
// devolve null em vez de travar o cadastro — a foto é um extra, nunca
// deve impedir o registro da encomenda.
export async function uploadPackagePhoto(file) {
  if (!file) return null;
  try {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from("package-photos")
      .upload(filename, file, { cacheControl: "3600", upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from("package-photos").getPublicUrl(filename);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

// Monta um link "wa.me" com a mensagem já pronta.
// O porteiro clica, o WhatsApp Web/App abre com o texto preenchido,
// e ele só confirma o envio. Não tem custo e não precisa de API paga.
export function buildWhatsAppLink(phone, message) {
  let digitsOnly = (phone || "").replace(/\D/g, "");

  // Se vier sem o código do país (formato comum em exportações de outros
  // sistemas: só DDD + número, 10 ou 11 dígitos), assume Brasil (55) e completa.
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    digitsOnly = "55" + digitsOnly;
  }

  const encoded = encodeURIComponent(message);
  return `https://wa.me/${digitsOnly}?text=${encoded}`;
}

export function defaultArrivalMessage({ recipient_name, carrier, street, house_number }) {
  return (
    `Olá! Chegou uma encomenda (${carrier}) para ${recipient_name}, ` +
    `${street}${house_number ? ", " + house_number : ""}. ` +
    `Pode retirar na portaria quando puder. 📦`
  );
}

export function exportPackagesToExcel(packages, filename = "entregas.xlsx", nameForProfileId = () => null) {
  const rows = packages.map((p) => ({
    Destinatário: p.recipient_name,
    Rua: p.street,
    Número: p.house_number || "",
    Transportadora: p.carrier,
    "Código de rastreio": p.tracking_code || "",
    Descrição: p.description || "",
    Entregador: p.courier_name || "",
    "CPF do entregador": p.courier_cpf || "",
    Status: p.status,
    "Recebido em": p.received_at ? new Date(p.received_at).toLocaleString("pt-BR") : "",
    "Registrado por": nameForProfileId(p.received_by) || "",
    "Entregue em": p.delivered_at ? new Date(p.delivered_at).toLocaleString("pt-BR") : "",
    "Retirado por": p.picked_up_by || "",
    "Confirmado por": nameForProfileId(p.delivered_by) || "",
    Ocorrência: p.occurrence_type || "",
    "Detalhe da ocorrência": p.occurrence_note || "",
    "Ocorrência registrada por": nameForProfileId(p.occurrence_by) || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Entregas");
  XLSX.writeFile(workbook, filename);
}

// Exporta o histórico da Conferência (aguardando, aceitas e recusadas) —
// serve como registro de auditoria de tudo que foi cadastrado pelos
// entregadores, mesmo o que foi recusado/cancelado.
export function exportSubmissionsToExcel(submissions, filename = "conferencia.xlsx", nameForProfileId = () => null) {
  const rows = submissions.map((s) => ({
    Destinatário: s.recipient_name,
    Rua: s.street,
    Número: s.house_number || "",
    Transportadora: s.carrier,
    "Código de rastreio": s.tracking_code || "",
    Descrição: s.description || "",
    Entregador: s.courier_name || "",
    "CPF do entregador": s.courier_cpf || "",
    Status: s.status,
    "Motivo da recusa": s.rejection_reason || "",
    "Enviado em": s.created_at ? new Date(s.created_at).toLocaleString("pt-BR") : "",
    "Conferido em": s.reviewed_at ? new Date(s.reviewed_at).toLocaleString("pt-BR") : "",
    "Conferido por": nameForProfileId(s.reviewed_by) || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Conferencia");
  XLSX.writeFile(workbook, filename);
}
