import { useState } from "react";

const REJECTION_REASONS = [
  "Peso incompatível",
  "Tamanho incompatível",
  "Endereço não encontrado",
  "Item danificado",
  "Outro motivo",
];

export default function SubmissionCard({ submission, onAccept, onReject }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [busy, setBusy] = useState(false);

  async function handleAccept() {
    setBusy(true);
    await onAccept(submission);
    setBusy(false);
  }

  async function handleConfirmReject() {
    setBusy(true);
    await onReject(submission, reason);
    setBusy(false);
  }

  return (
    <div className="package-card pendente">
      <div className="package-top">
        <div>
          <div className="package-recipient">{submission.recipient_name}</div>
          <div className="package-address">
            {submission.street}{submission.house_number ? `, ${submission.house_number}` : ""}
          </div>
        </div>
        <span className="carrier-badge">{submission.carrier}</span>
      </div>

      {submission.description && (
        <div className="package-desc">{submission.description}</div>
      )}

      {submission.photo_url && (
        <a href={submission.photo_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8 }}>
          <img
            src={submission.photo_url}
            alt="Foto da encomenda"
            style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1.5px solid var(--stone-dark)" }}
          />
        </a>
      )}

      <div className="package-meta">
        {submission.courier_name && (
          <span>
            Enviado por: {submission.courier_name}
            {submission.courier_cpf ? ` · CPF ${submission.courier_cpf}` : ""}
          </span>
        )}
        <span>{new Date(submission.created_at).toLocaleString("pt-BR")}</span>
      </div>

      {submission.tracking_code && (
        <div className="package-tracking mono">{submission.tracking_code}</div>
      )}

      {!rejecting ? (
        <div className="package-actions">
          <button className="btn btn-primary btn-sm" onClick={handleAccept} disabled={busy}>
            {busy ? "Aguarde..." : "Aceitar"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setRejecting(true)}
            disabled={busy}
          >
            Recusar
          </button>
        </div>
      ) : (
        <div className="field" style={{ marginTop: 10 }}>
          <label>Motivo da recusa</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REJECTION_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="package-actions">
            <button className="btn btn-primary btn-sm" onClick={handleConfirmReject} disabled={busy}>
              {busy ? "Aguarde..." : "Confirmar recusa"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRejecting(false)} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
