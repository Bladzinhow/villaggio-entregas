import { useState } from "react";
import { supabase } from "../supabaseClient";
import { findDuplicateTracking, uploadPackagePhoto } from "../utils";
import BarcodeScannerButton from "./BarcodeScannerButton";

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

export default function NewPackageModal({ onClose, onCreated, profileId, editingPackage }) {
  const isEditing = !!editingPackage;
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

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (duplicateWarning) setDuplicateWarning(null); // qualquer edição limpa o aviso anterior
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

    const { error } = isEditing
      ? await supabase.from("packages").update(payload).eq("id", editingPackage.id)
      : await supabase.from("packages").insert({ ...payload, received_by: profileId, status: "pendente" });

    setSaving(false);
    if (error) {
      setError("Não foi possível salvar. Tente novamente.");
      return;
    }
    onCreated();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEditing ? "Editar encomenda" : "Nova encomenda"}</h2>
        <p className="modal-sub">
          {isEditing ? "Corrija os dados que estavam errados" : "Registre o recebimento na portaria"}
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

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Destinatário</label>
            <input
              value={form.recipient_name}
              onChange={(e) => update("recipient_name", e.target.value)}
              placeholder="Nome completo"
              required
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
            <label>Transportadora</label>
            <select value={form.carrier} onChange={(e) => update("carrier", e.target.value)}>
              {CARRIERS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
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

          <div className="field-row">
            <div className="field">
              <label>Nome do entregador (opcional)</label>
              <input
                value={form.courier_name}
                onChange={(e) => update("courier_name", e.target.value)}
                placeholder="Ex.: Robson"
              />
            </div>
            <div className="field">
              <label>CPF do entregador (opcional)</label>
              <input
                value={form.courier_cpf}
                onChange={(e) => update("courier_cpf", e.target.value)}
                placeholder="Somente números"
              />
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
