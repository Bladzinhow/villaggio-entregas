import { useState } from "react";
import { supabase } from "../supabaseClient";

const CARRIERS = ["Shopee", "Mercado Livre", "Amazon", "Correios", "Transportadora", "Outro"];

export default function NewPackageModal({ onClose, onCreated, profileId }) {
  const [form, setForm] = useState({
    recipient_name: "",
    street: "",
    house_number: "",
    carrier: "Shopee",
    tracking_code: "",
    description: "",
    courier_name: "",
    courier_cpf: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const { error } = await supabase.from("packages").insert({
      recipient_name: form.recipient_name,
      street: form.street,
      house_number: form.house_number || null,
      carrier: form.carrier,
      tracking_code: form.tracking_code || null,
      description: form.description || null,
      courier_name: form.courier_name || null,
      courier_cpf: form.courier_cpf || null,
      received_by: profileId,
      status: "pendente",
    });

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
        <h2>Nova encomenda</h2>
        <p className="modal-sub">Registre o recebimento na portaria</p>

        {error && <div className="login-error">{error}</div>}

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
            <input
              value={form.tracking_code}
              onChange={(e) => update("tracking_code", e.target.value)}
              placeholder="Ex.: BR265724656594I"
            />
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
              {saving ? "Salvando..." : "Registrar encomenda"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
