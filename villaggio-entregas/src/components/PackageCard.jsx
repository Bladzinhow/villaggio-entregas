import { useState } from "react";
import { buildWhatsAppLink, defaultArrivalMessage, daysSince, AGING_THRESHOLD_DAYS, buildPickupLink } from "../utils";

const OCCURRENCE_TYPES = [
  { value: "avaria", label: "Avaria" },
  { value: "extravio", label: "Extravio" },
  { value: "outro", label: "Outro" },
];

export default function PackageCard({ pkg, residentPhone, onConfirmDelivery, onEdit, onRegisterOccurrence, nameForProfileId, agingAlertDays }) {
  const isDelivered = pkg.status === "entregue";
  const [confirming, setConfirming] = useState(false);
  const [pickedUpBy, setPickedUpBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [occurring, setOccurring] = useState(false);
  const [occType, setOccType] = useState("avaria");
  const [occNote, setOccNote] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const whatsappHref = residentPhone
    ? buildWhatsAppLink(residentPhone, defaultArrivalMessage(pkg))
    : null;

  const ageDays = daysSince(pkg.received_at);
  const isAging = !isDelivered && ageDays >= (agingAlertDays || AGING_THRESHOLD_DAYS);

  function copyPickupLink() {
    const link = buildPickupLink(pkg.pickup_token);
    navigator.clipboard?.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handleConfirm() {
    setBusy(true);
    await onConfirmDelivery(pkg, pickedUpBy.trim() || null);
    setBusy(false);
    setConfirming(false);
  }

  async function handleSaveOccurrence() {
    setBusy(true);
    await onRegisterOccurrence(pkg, occType, occNote.trim());
    setBusy(false);
    setOccurring(false);
    setOccNote("");
  }

  return (
    <div className={`package-card ${pkg.status}`}>
      <div className="package-top">
        <div>
          <div className="package-recipient">{pkg.recipient_name}</div>
          <div className="package-address">
            {pkg.street}{pkg.house_number ? `, ${pkg.house_number}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
          <span className="carrier-badge">{pkg.carrier}</span>
          {isAging && (
            <span className="status-pill" style={{ background: "#FBEAE8", color: "#A6423A" }}>
              Parada há {ageDays} dias
            </span>
          )}
        </div>
      </div>

      {pkg.occurrence_type && (
        <div className="package-desc" style={{ background: "#FBEAE8", color: "#A6423A" }}>
          Ocorrência ({pkg.occurrence_type}){pkg.occurrence_note ? `: ${pkg.occurrence_note}` : ""}
        </div>
      )}

      {pkg.description && <div className="package-desc">{pkg.description}</div>}

      {pkg.photo_url && (
        <a href={pkg.photo_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8 }}>
          <img
            src={pkg.photo_url}
            alt="Foto da encomenda"
            style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1.5px solid var(--stone-dark)" }}
          />
        </a>
      )}

      <div className="package-meta">
        <span className={`status-pill ${pkg.status}`}>{pkg.status}</span>
        {pkg.courier_name && <span>Entregador: {pkg.courier_name}{pkg.courier_cpf ? ` · CPF ${pkg.courier_cpf}` : ""}</span>}
        <span>{new Date(pkg.received_at).toLocaleString("pt-BR")}</span>
        {nameForProfileId?.(pkg.received_by) && <span>Registrado por: {nameForProfileId(pkg.received_by)}</span>}
      </div>

      {pkg.tracking_code && (
        <div className="package-tracking mono">{pkg.tracking_code}</div>
      )}

      {isDelivered && (
        <div className="package-meta" style={{ marginTop: 4 }}>
          {pkg.picked_up_by && <span>Retirado por: {pkg.picked_up_by}</span>}
          {nameForProfileId?.(pkg.delivered_by) && <span>Confirmado por: {nameForProfileId(pkg.delivered_by)}</span>}
        </div>
      )}

      {pkg.occurrence_type && nameForProfileId?.(pkg.occurrence_by) && (
        <div className="package-meta" style={{ marginTop: 4 }}>
          <span>Ocorrência registrada por: {nameForProfileId(pkg.occurrence_by)}</span>
        </div>
      )}

      {!confirming && !occurring ? (
        <div className="package-actions">
          {whatsappHref && (
            <a
              className="btn btn-ghost btn-sm"
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
            >
              Avisar por WhatsApp
            </a>
          )}
          {!isDelivered && (
            <button className="btn btn-primary btn-sm" onClick={() => setConfirming(true)}>
              Confirmar entrega
            </button>
          )}
          {!isDelivered && pkg.pickup_token && (
            <button className="btn btn-ghost btn-sm" onClick={copyPickupLink}>
              {linkCopied ? "Link copiado!" : "Copiar link de retirada"}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(pkg)}>
            Editar
          </button>
          {!pkg.occurrence_type && (
            <button className="btn btn-ghost btn-sm" onClick={() => setOccurring(true)}>
              Registrar ocorrência
            </button>
          )}
        </div>
      ) : confirming ? (
        <div className="field" style={{ marginTop: 10 }}>
          <label>Quem está retirando? (opcional, mas recomendado)</label>
          <input
            autoFocus
            value={pickedUpBy}
            onChange={(e) => setPickedUpBy(e.target.value)}
            placeholder="Nome de quem está retirando"
          />
          <div className="package-actions">
            <button className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={busy}>
              {busy ? "Aguarde..." : "Confirmar entrega"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="field" style={{ marginTop: 10 }}>
          <label>Tipo de ocorrência</label>
          <select value={occType} onChange={(e) => setOccType(e.target.value)}>
            {OCCURRENCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <div style={{ marginTop: 8 }}>
            <label>Detalhes</label>
            <textarea
              rows={2}
              value={occNote}
              onChange={(e) => setOccNote(e.target.value)}
              placeholder="Ex.: Caixa amassada na chegada"
            />
          </div>
          <div className="package-actions">
            <button className="btn btn-primary btn-sm" onClick={handleSaveOccurrence} disabled={busy}>
              {busy ? "Aguarde..." : "Salvar ocorrência"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setOccurring(false)} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
