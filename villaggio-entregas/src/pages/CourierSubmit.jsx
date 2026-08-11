import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { uploadPackagePhoto, isWithinBusinessHours, BUSINESS_HOURS_LABEL } from "../utils";

const CARRIERS = ["Shopee", "Mercado Livre", "Amazon", "Correios", "Transportadora", "Outro"];

// Estes são os campos que se repetem quando o MESMO entregador manda
// várias encomendas seguidas (ex.: 30 pacotes da mesma transportadora
// no mesmo dia). Guardamos no navegador dele (localStorage) para não
// precisar redigitar toda vez. Os campos específicos de cada pacote
// (destinatário, rua, rastreio) sempre começam vazios.
const REMEMBER_KEY = "villaggio_courier_last_values";

function loadRemembered() {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRemembered(values) {
  try {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify(values));
  } catch {
    // se o navegador bloquear localStorage, apenas não lembra — sem quebrar o app
  }
}

const emptyForm = () => ({
  recipient_name: "",
  street: "",
  house_number: "",
  carrier: "Shopee",
  tracking_code: "",
  description: "",
  courier_name: "",
  courier_cpf: "",
  courier_phone: "",
});

export default function CourierSubmit() {
  const [form, setForm] = useState(emptyForm());
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSent, setJustSent] = useState(false);
  const [withinHours, setWithinHours] = useState(isWithinBusinessHours());

  // Ao abrir a página, pré-preenche com os últimos dados "repetíveis" salvos neste aparelho
  useEffect(() => {
    const remembered = loadRemembered();
    setForm((f) => ({ ...f, ...remembered }));
  }, []);

  // Reavalia o horário periodicamente, caso a pessoa deixe a tela aberta
  // e o horário mude enquanto isso (ex.: passou das 18h).
  useEffect(() => {
    const interval = setInterval(() => setWithinHours(isWithinBusinessHours()), 60000);
    return () => clearInterval(interval);
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const photo_url = photoFile ? await uploadPackagePhoto(photoFile) : null;

    const { error } = await supabase.from("submissions").insert({
      recipient_name: form.recipient_name,
      street: form.street,
      house_number: form.house_number || null,
      carrier: form.carrier,
      tracking_code: form.tracking_code || null,
      description: form.description || null,
      courier_name: form.courier_name || null,
      courier_cpf: form.courier_cpf || null,
      courier_phone: form.courier_phone || null,
      photo_url,
      status: "pendente",
    });

    setSaving(false);

    if (error) {
      if (!isWithinBusinessHours()) {
        setWithinHours(false);
      } else {
        setError("Não foi possível enviar. Verifique a internet e tente novamente.");
      }
      return;
    }

    // Lembra só os campos que tendem a se repetir no próximo pacote
    saveRemembered({
      carrier: form.carrier,
      courier_name: form.courier_name,
      courier_cpf: form.courier_cpf,
      courier_phone: form.courier_phone,
    });

    setJustSent(true);
  }

  function handleNext() {
    // Começa a próxima encomenda: limpa só o que muda pacote a pacote
    const remembered = loadRemembered();
    setForm({ ...emptyForm(), ...remembered });
    setPhotoFile(null);
    setPhotoPreview(null);
    setJustSent(false);
  }

  if (!withinHours) {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div className="login-mark" style={{ background: "var(--ink-soft)" }}>⏰</div>
          <h1>Fora do horário de atendimento</h1>
          <p className="login-sub">
            O cadastro de encomendas fica disponível apenas em horário útil.
          </p>
          <div className="package-desc" style={{ display: "block", marginTop: 6 }}>
            {BUSINESS_HOURS_LABEL}
          </div>
          <p className="text-muted" style={{ marginTop: 16 }}>
            Volte dentro desse horário, ou fale com a portaria diretamente.
          </p>
        </div>
      </div>
    );
  }

  if (justSent) {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div className="login-mark" style={{ background: "var(--green)" }}>✓</div>
          <h1>Enviado!</h1>
          <p className="login-sub">
            A portaria vai conferir e confirmar o recebimento.
          </p>
          <button className="btn btn-primary full-width" onClick={handleNext}>
            Cadastrar próxima encomenda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-card" style={{ maxWidth: 440 }}>
        <div className="login-mark">V</div>
        <h1>Villaggio Paradiso</h1>
        <p className="login-sub">Cadastro de encomenda — Entregador</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Destinatário</label>
            <input
              value={form.recipient_name}
              onChange={(e) => update("recipient_name", e.target.value)}
              placeholder="Nome completo"
              required
              autoFocus
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Rua</label>
              <input
                value={form.street}
                onChange={(e) => update("street", e.target.value)}
                placeholder="Ex.: Rua Belluno"
                required
              />
            </div>
            <div className="field">
              <label>Número / Unidade</label>
              <input
                value={form.house_number}
                onChange={(e) => update("house_number", e.target.value)}
                placeholder="Ex.: 128"
              />
            </div>
          </div>

          <div className="field">
            <label>Código de rastreio (opcional)</label>
            <input
              value={form.tracking_code}
              onChange={(e) => update("tracking_code", e.target.value)}
              placeholder="Ex.: BR265724656594I"
            />
          </div>

          <div className="field">
            <label>Descrição do item (opcional)</label>
            <input
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Ex.: Caixa pequena"
            />
          </div>

          <div className="field">
            <label>Foto da encomenda (opcional, recomendado)</label>
            {photoPreview ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img
                  src={photoPreview}
                  alt="Prévia da foto"
                  style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1.5px solid var(--stone-dark)" }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                >
                  Remover
                </button>
              </div>
            ) : (
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} />
            )}
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--stone-dark)", margin: "16px 0" }} />
          <p className="text-muted" style={{ marginBottom: 10 }}>
            Seus dados (lembrados para a próxima encomenda):
          </p>

          <div className="field">
            <label>Transportadora</label>
            <select value={form.carrier} onChange={(e) => update("carrier", e.target.value)}>
              {CARRIERS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Seu nome</label>
              <input
                value={form.courier_name}
                onChange={(e) => update("courier_name", e.target.value)}
                placeholder="Ex.: Robson"
              />
            </div>
            <div className="field">
              <label>Seu CPF</label>
              <input
                value={form.courier_cpf}
                onChange={(e) => update("courier_cpf", e.target.value)}
                placeholder="Somente números"
              />
            </div>
          </div>

          <button className="btn btn-primary full-width" type="submit" disabled={saving}>
            {saving ? "Enviando..." : "Enviar para conferência"}
          </button>
        </form>
      </div>
    </div>
  );
}
