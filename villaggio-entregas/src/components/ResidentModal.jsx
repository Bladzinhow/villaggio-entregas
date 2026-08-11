import { useState } from "react";
import { supabase } from "../supabaseClient";

const blankForm = { full_name: "", street: "", house_number: "", phone: "", notes: "" };

export default function ResidentModal({ onClose, onSaved, editingResident }) {
  const isEditing = !!editingResident;
  const [form, setForm] = useState(
    isEditing
      ? {
          full_name: editingResident.full_name || "",
          street: editingResident.street || "",
          house_number: editingResident.house_number || "",
          phone: editingResident.phone || "",
          notes: editingResident.notes || "",
        }
      : blankForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const payload = {
      full_name: form.full_name,
      street: form.street,
      house_number: form.house_number || null,
      phone: form.phone || null,
      notes: form.notes || null,
    };

    const { error } = isEditing
      ? await supabase.from("residents").update(payload).eq("id", editingResident.id)
      : await supabase.from("residents").insert(payload);

    setSaving(false);
    if (error) {
      setError("Não foi possível salvar. Tente novamente.");
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEditing ? "Editar morador" : "Novo morador"}</h2>
        <p className="modal-sub">
          {isEditing ? "Corrija os dados desse morador" : "Cadastre um morador para habilitar o aviso por WhatsApp"}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nome completo</label>
            <input
              autoFocus
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder="Nome do morador"
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
            <label>Telefone (WhatsApp)</label>
            <input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="Ex.: 11987654321 (com DDD)"
            />
          </div>

          <div className="field">
            <label>Observações (opcional)</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Ex.: Inquilino, contato alternativo, etc."
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Cadastrar morador"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
