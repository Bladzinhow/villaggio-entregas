import { buildWhatsAppLink, defaultArrivalMessage } from "../utils";

export default function PackageCard({ pkg, residentPhone, onConfirmDelivery }) {
  const isDelivered = pkg.status === "entregue";

  const whatsappHref = residentPhone
    ? buildWhatsAppLink(residentPhone, defaultArrivalMessage(pkg))
    : null;

  return (
    <div className={`package-card ${pkg.status}`}>
      <div className="package-top">
        <div>
          <div className="package-recipient">{pkg.recipient_name}</div>
          <div className="package-address">
            {pkg.street}{pkg.house_number ? `, ${pkg.house_number}` : ""}
          </div>
        </div>
        <span className="carrier-badge">{pkg.carrier}</span>
      </div>

      {pkg.description && <div className="package-desc">{pkg.description}</div>}

      <div className="package-meta">
        <span className={`status-pill ${pkg.status}`}>{pkg.status}</span>
        {pkg.courier_name && <span>Entregador: {pkg.courier_name}{pkg.courier_cpf ? ` · CPF ${pkg.courier_cpf}` : ""}</span>}
        <span>{new Date(pkg.received_at).toLocaleString("pt-BR")}</span>
      </div>

      {pkg.tracking_code && (
        <div className="package-tracking mono">{pkg.tracking_code}</div>
      )}

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
          <button className="btn btn-primary btn-sm" onClick={() => onConfirmDelivery(pkg)}>
            Confirmar entrega
          </button>
        )}
      </div>
    </div>
  );
}
