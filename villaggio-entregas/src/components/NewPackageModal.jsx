import { useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { findDuplicateTracking, uploadPackagePhoto, scanLabelWithAI } from "../utils";
import { runFreeOcr } from "../ocr";
import BarcodeScannerButton from "./BarcodeScannerButton";
import FreeOcrButton from "./FreeOcrButton";

const CARRIERS = ["Shopee", "Mercado Livre", "Amazon", "Correios", "Transportadora", "Outro"];

const blankForm = {
  recipient_name: "",
  street: "",
  house_number: "",
  carrier: "Shopee",
  tracking_code: "",
  description: "",
  courier_name: "",
  courier_cpf: "",
};

export default function NewPackageModal({ onClose, onCreated, profileId, editingPackage, aiScanEnabled }) {
  const isEditing = !!editingPackage;

  // Fluxo: ao CRIAR, começa pela foto ("photo"); depois de ler (ou pular),
  // vai para o formulário normal ("form") já pré-preenchido para revisar.
  // Ao EDITAR, vai direto para o formulário — a foto é só um extra ali.
  const [step, setStep] = useState(isEditing ? "form" : "photo");
  const [readingPhoto, setReadingPhoto] = useState(false);
  const captureInputRef = useRef(null);

  const [form, setForm] = useState(
    isEditing
      ? {
          recipient_name: editingPackage.recipient_name || "",
          street: editingPackage.street || "",
          house_number: editingPackage.house_number || "",
          carrier: editingPackage.carrier || "Shopee",
          tracking_code: editingPackage.tracking_code || "",
          description: editingPackage.description || "",
          courier_name: editingPackage.courier_name || "",
          courier_cpf: editingPackage.courier_cpf || "",
        }
      : blankForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(editingPackage?.photo_url || null);
  const [aiFilledFields, setAiFilledFields] = useState({});

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (duplicateWarning) setDuplicateWarning(null); // qualquer edição limpa o aviso anterior
    if (aiFilledFields[field]) setAiFilledFields((prev) => ({ ...prev, [field]: false }));
  }

  function applyResult(result, filledMap) {
    setForm((f) => {
      const next = { ...f };
      if (result.tracking_code) { next.tracking_code = result.tracking_code; filledMap.tracking_code = true; }
      if (result.recipient_name) { next.recipient_name = result.recipient_name; filledMap.recipient_name = true; }
      if (result.street) { next.street = result.street; filledMap.street = true; }
      if (result.house_number) { next.house_number = result.house_number; filledMap.house_number = true; }
      if (result.carrier && CARRIERS.includes(result.carrier)) { next.carrier = result.carrier; filledMap.carrier = true; }
      return next;
    });
  }

  // Passo 1: tirou a foto da etiqueta. Essa MESMA foto já fica salva como
  // a "foto da encomenda" (prova de recebimento) — não precisa tirar duas
  // fotos. Em seguida, tenta ler automaticamente (grátis, e também com IA
  // se estiver ligada) e já segue para o formulário preenchido.
  async function handleCaptureLabel(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setReadingPhoto(true);

    const filled = {};
    try {
      const freeResult = await runFreeOcr(file);
      applyResult(freeResult, filled);
    } catch {
      // leitura grátis falhou — segue sem travar, o formulário fica em branco pra corrigir
    }

    if (aiScanEnabled) {
      try {
        const aiResult = await scanLabelWithAI(file);
        applyResult(aiResult, filled); // a IA, quando acerta, substitui o palpite do OCR grátis
      } catch {
        // IA falhou/não configurada — já temos o que o OCR grátis conseguiu
      }
    }

    setAiFilledFields(filled);
    setReadingPhoto(false);
    setStep("form");
  }

  function skipPhotoStep() {
    setStep("form");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Só verifica de novo se ainda não confirmamos um duplicado igual a este
    if (!duplicateWarning) {
      const existing = await findDuplicateTracking(form.tracking_code, editingPackage?.id);
      if (existing) {
        setDuplicateWarning(existing);
        return; // não salva ainda — espera confirmação
      }
    }

    setSaving(true);

    // Só sobe uma foto nova se o usuário tirou/escolheu uma agora.
    // Se estiver editando e não mudou a foto, mantém o link que já existia.
    const photo_url = photoFile ? await uploadPackagePhoto(photoFile) : editingPackage?.photo_url || null;

    const payload = {
      recipient_name: form.recipient_name,
      street: form.street,
      house_number: form.house_number || null,
      carrier: form.carrier,
      tracking_code: form.tracking_code || null,
      description: form.description || null,
      courier_name: form.courier_name || null,
      courier_cpf: form.courier_cpf || null,
      photo_url,
    };

    if (isEditing) {
      const { error } = await supabase.from("packages").update(payload).eq("id", editingPackage.id);
      setSaving(false);
      if (error) { setError("Não foi possível salvar. Tente novamente."); return; }
      onCreated();
    } else {
      const { data, error } = await supabase
        .from("packages")
        .insert({ ...payload, received_by: profileId, status: "pendente" })
        .select("id")
        .single();
      setSaving(false);
      if (error) { setError("Não foi possível salvar. Tente novamente."); return; }
      onCreated(data?.id);
    }
  }

  const aiHint = (field) =>
    aiFilledFields[field] ? <span className="ai-filled-hint">✨ preenchido automaticamente — confira</span> : null;

  // ------------------------------------------------------------
  // Passo 1: tela de "comece pela foto"
  // ------------------------------------------------------------
  if (step === "photo") {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>Nova encomenda</h2>
          <p className="modal-sub">Comece tirando uma foto da etiqueta — o resto do formulário é preenchido sozinho.</p>

          <div className="photo-first-box">
            {readingPhoto ? (
              <>
                {photoPreview && (
                  <img src={photoPreview} alt="Prévia da foto" className="photo-first-preview" />
                )}
                <p className="photo-first-status">🔎 Lendo a etiqueta...</p>
              </>
            ) : (
              <>
                <div className="photo-first-icon">📷</div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => captureInputRef.current?.click()}
                >
                  Tirar foto da etiqueta
                </button>
                <input
                  ref={captureInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCaptureLabel}
                  style={{ display: "none" }}
                />
                <p className="text-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
                  {aiScanEnabled
                    ? "Essa foto também fica salva como prova de recebimento, e é lida automaticamente (OCR grátis + IA)."
                    : "Essa foto também fica salva como prova de recebimento, e é lida automaticamente (leitura gratuita de código de rastreio)."}
                </p>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn btn-ghost" onClick={skipPhotoStep} disabled={readingPhoto}>
              Preencher manualmente, sem foto
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // Passo 2: formulário (já pré-preenchido, se veio do passo 1)
  // ------------------------------------------------------------
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEditing ? "Editar encomenda" : "Nova encomenda"}</h2>
        <p className="modal-sub">
          {isEditing
            ? "Corrija os dados que estavam errados"
            : Object.keys(aiFilledFields).length > 0
            ? "Confira os campos preenchidos automaticamente e corrija o que precisar"
            : "Registre o recebimento na portaria"}
        </p>

        {error && <div className="login-error">{error}</div>}

        {duplicateWarning && (
          <div className="login-error" style={{ background: "#FBF0DC", color: "#8F6420" }}>
            Já existe uma encomenda com esse código de rastreio: <strong>{duplicateWarning.recipient_name}</strong>,{" "}
            {duplicateWarning.street}
            {duplicateWarning.house_number ? `, ${duplicateWarning.house_number}` : ""} — status{" "}
            <strong>{duplicateWarning.status}</strong>. Clique em "Cadastrar mesmo assim" se tiver certeza que é uma
            encomenda diferente.
          </div>
        )}

        {!isEditing && !photoPreview && (
          <div className="form-section ai-section">
            <div className="form-section-title">📷 Ainda dá tempo</div>
            <p className="text-muted" style={{ marginTop: -4, marginBottom: 10, fontSize: 13 }}>
              Pode tirar a foto da etiqueta agora para tentar preencher os campos abaixo.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <FreeOcrButton onResult={(r) => { applyResult(r, {}); setAiFilledFields((prev) => ({ ...prev, tracking_code: !!r.tracking_code })); }} />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-section-title">1. Encomenda</div>

            <div className="field">
              <label>Transportadora</label>
              <select value={form.carrier} onChange={(e) => update("carrier", e.target.value)}>
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {aiHint("carrier")}
            </div>

            <div className="field">
              <label>Código de rastreio (opcional)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{ flex: 1 }}
                  value={form.tracking_code}
                  onChange={(e) => update("tracking_code", e.target.value)}
                  placeholder="Ex.: BR265724656594I"
                />
                <BarcodeScannerButton onScan={(text) => update("tracking_code", text)} />
              </div>
              {aiHint("tracking_code")}
            </div>

            <div className="field">
              <label>Descrição do item (opcional)</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Ex.: Caixa organizadora, 2 unidades"
              />
            </div>

            <div className="field">
              <label>Foto da encomenda{photoPreview ? "" : " (opcional, recomendado)"}</label>
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
          </div>

          <div className="form-section">
            <div className="form-section-title">2. Para quem é</div>

            <div className="field">
              <label>Destinatário</label>
              <input
                value={form.recipient_name}
                onChange={(e) => update("recipient_name", e.target.value)}
                placeholder="Nome completo"
                required
              />
              {aiHint("recipient_name")}
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
                {aiHint("street")}
              </div>
              <div className="field">
                <label>Número / Unidade</label>
                <input
                  value={form.house_number}
                  onChange={(e) => update("house_number", e.target.value)}
                  placeholder="Ex.: 128"
                />
                {aiHint("house_number")}
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">3. Quem entregou (opcional)</div>
            <div className="field-row">
              <div className="field">
                <label>Nome do entregador</label>
                <input
                  value={form.courier_name}
                  onChange={(e) => update("courier_name", e.target.value)}
                  placeholder="Ex.: Robson"
                />
              </div>
              <div className="field">
                <label>CPF do entregador</label>
                <input
                  value={form.courier_cpf}
                  onChange={(e) => update("courier_cpf", e.target.value)}
                  placeholder="Somente números"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving
                ? "Salvando..."
                : duplicateWarning
                ? "Salvar mesmo assim"
                : isEditing
                ? "Salvar alterações"
                : "Registrar encomenda"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
