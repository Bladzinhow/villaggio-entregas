import { useState } from "react";
import { updateSettings } from "../utils";

export default function SettingsPanel({ settings, isSindico, onSaved }) {
  const [form, setForm] = useState(
    settings || {
      aging_alert_days: 7,
      aging_expire_days: 30,
      custom_message: "",
      notify_email_enabled: false,
      ai_scan_enabled: false,
    }
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!settings) return <p className="text-muted">Carregando...</p>;

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const ok = await updateSettings({
      aging_alert_days: Number(form.aging_alert_days) || 7,
      aging_expire_days: Number(form.aging_expire_days) || 30,
      custom_message: form.custom_message || null,
      notify_email_enabled: !!form.notify_email_enabled,
      ai_scan_enabled: !!form.ai_scan_enabled,
    });
    setSaving(false);
    if (ok) {
      setSaved(true);
      onSaved(form);
    } else {
      alert("Não foi possível salvar. Só síndicos podem alterar as configurações.");
    }
  }

  return (
    <div>
      <div className="settings-section">
        <h3>⏰ Regras de armazenamento</h3>
        <p>Controla quando uma encomenda parada passa a aparecer como "Atenção" no painel.</p>
        <div className="field-row">
          <div className="field">
            <label>Avisar depois de quantos dias parada?</label>
            <input
              type="number"
              min={1}
              value={form.aging_alert_days}
              onChange={(e) => update("aging_alert_days", e.target.value)}
              disabled={!isSindico}
            />
          </div>
          <div className="field">
            <label>Considerar "muito atrasada" depois de quantos dias?</label>
            <input
              type="number"
              min={1}
              value={form.aging_expire_days}
              onChange={(e) => update("aging_expire_days", e.target.value)}
              disabled={!isSindico}
            />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>✉️ Mensagem personalizada</h3>
        <p>Esse texto aparece no e-mail automático enviado ao morador (se estiver ligado abaixo).</p>
        <div className="field">
          <textarea
            rows={2}
            value={form.custom_message || ""}
            onChange={(e) => update("custom_message", e.target.value)}
            placeholder="Ex.: Por favor, retire sua encomenda na portaria entre 8h e 22h."
            disabled={!isSindico}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>🔌 Recursos</h3>
        <p>Ligue aqui recursos que dependem de configuração extra fora do app.</p>

        <div className="toggle-row">
          <div>
            <div className="toggle-row-label">Notificar morador por e-mail automaticamente</div>
            <div className="toggle-row-desc">
              Precisa configurar o Edge Function "notify-arrival" com uma conta Resend (veja o README, Parte 13).
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!form.notify_email_enabled}
            onChange={(e) => update("notify_email_enabled", e.target.checked)}
            disabled={!isSindico}
          />
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-row-label">Leitura de etiqueta por IA ("Preencher com IA")</div>
            <div className="toggle-row-desc">
              Precisa configurar o Edge Function "scan-label" com uma chave da API da Anthropic (veja o README, Parte 13).
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!form.ai_scan_enabled}
            onChange={(e) => update("ai_scan_enabled", e.target.checked)}
            disabled={!isSindico}
          />
        </div>
      </div>

      {isSindico ? (
        <div className="package-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
          {saved && <span className="text-muted">Salvo!</span>}
        </div>
      ) : (
        <p className="text-muted">Só síndicos podem alterar estas configurações.</p>
      )}
    </div>
  );
}
