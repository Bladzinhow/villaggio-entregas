// Leitura de etiqueta gratuita (OCR local, sem custo, sem conta) — lógica
// compartilhada entre o fluxo "iniciar pela foto" e o botão avulso
// "🆓 Ler etiqueta (grátis)".
export async function runFreeOcr(file) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por");
  const { data } = await worker.recognize(file);
  await worker.terminate();

  const text = data.text || "";
  return { tracking_code: guessTrackingCode(text), raw_text: text };
}

// Tenta achar, no texto lido, o trecho que mais parece um código de
// rastreio: geralmente uma sequência única de letras e números, sem
// espaços, de 8 a 20 caracteres (ex.: BR265724656594I, NM123456789).
// Nunca é 100% garantido — por isso sempre fica fácil de corrigir à mão.
export function guessTrackingCode(text) {
  const candidates = text.match(/\b[A-Z0-9]{8,20}\b/gi) || [];
  if (candidates.length === 0) return null;

  // Prioriza o padrão clássico dos Correios: 2 letras + 9 números + 2 letras
  const correios = candidates.find((c) => /^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(c));
  if (correios) return correios.toUpperCase();

  // Senão, usa o candidato mais longo (tende a ser o código, não uma palavra comum)
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0].toUpperCase();
}
