import { useRef, useState } from "react";
import { scanLabelWithAI } from "../utils";

// Botão "Preencher com IA": abre a câmera, tira foto da etiqueta, e
// devolve ao componente pai os campos que a IA conseguiu identificar.
// Só aparece quando o síndico liga essa função nas Configurações.
export default function AiScanButton({ onResult }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite tirar outra foto depois, mesmo arquivo
    if (!file) return;

    setLoading(true);
    setError("");
    try {
      const result = await scanLabelWithAI(file);
      onResult(result);
    } catch (err) {
      setError(err.message || "Não foi possível ler a etiqueta.");
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
        {loading ? "Lendo etiqueta..." : "✨ Preencher com IA"}
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
    </div>
  );
}
