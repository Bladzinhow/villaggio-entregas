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

export const AGING_THRESHOLD_DAYS = 7;

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

export function exportPackagesToExcel(packages, filename = "entregas.xlsx") {
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
    "Entregue em": p.delivered_at ? new Date(p.delivered_at).toLocaleString("pt-BR") : "",
    "Retirado por": p.picked_up_by || "",
    Ocorrência: p.occurrence_type || "",
    "Detalhe da ocorrência": p.occurrence_note || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Entregas");
  XLSX.writeFile(workbook, filename);
}
