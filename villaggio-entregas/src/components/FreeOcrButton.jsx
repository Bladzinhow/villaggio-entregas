import { useRef, useState } from "react";
import { runFreeOcr } from "../ocr";

// Botão avulso de OCR gratuito, para quando a pessoa já está no formulário
// e quer (re)ler uma etiqueta — ex.: depois de preencher manualmente, ou
// para tentar de novo com outra foto. O fluxo principal "iniciar pela
// foto" (no NewPackageModal/CourierSubmit) usa a mesma lógica, mas chama
// runFreeOcr diretamente em vez deste componente.
export default function FreeOcrButton({ onResult }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rawText, setRawText] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setLoading(true);
    setError("");
    setRawText("");

    try {
      const result = await runFreeOcr(file);
      setRawText(result.raw_text);
      onResult(result);
    } catch {
      setError("Não foi possível ler essa foto. Tente uma imagem mais nítida ou preencha manualmente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        style={{ whiteSpace: "nowrap" }}
      >
        {loading ? "Lendo etiqueta..." : "🆓 Ler etiqueta (grátis)"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: "none" }}
      />
      {error && (
        <div className="text-muted" style={{ fontSize: 12, color: "var(--red)", marginTop: 4 }}>
          {error}
        </div>
      )}
      {rawText && (
        <details style={{ marginTop: 6 }}>
          <summary className="text-muted" style={{ fontSize: 12, cursor: "pointer" }}>
            Ver texto lido na etiqueta (para conferir nome/endereço)
          </summary>
          <pre
            style={{
              fontSize: 11,
              whiteSpace: "pre-wrap",
              background: "#F6F4EF",
              padding: 8,
              borderRadius: 6,
              marginTop: 4,
              maxHeight: 120,
              overflow: "auto",
            }}
          >
            {rawText}
          </pre>
        </details>
      )}
    </div>
  );
}
