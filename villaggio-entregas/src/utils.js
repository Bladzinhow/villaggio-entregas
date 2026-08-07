import * as XLSX from "xlsx";

// Monta um link "wa.me" com a mensagem já pronta.
// O porteiro clica, o WhatsApp Web/App abre com o texto preenchido,
// e ele só confirma o envio. Não tem custo e não precisa de API paga.
export function buildWhatsAppLink(phone, message) {
  const digitsOnly = (phone || "").replace(/\D/g, "");
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
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Entregas");
  XLSX.writeFile(workbook, filename);
}
