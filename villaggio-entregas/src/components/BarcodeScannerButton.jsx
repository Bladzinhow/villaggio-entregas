import { useEffect, useRef, useState } from "react";

// Botão que abre a câmera e lê códigos de barras (Code128, EAN, etc.) e QR
// codes, preenchendo automaticamente o campo de rastreio. Funciona 100% no
// navegador, sem custo e sem depender de internet no momento da leitura.
// Se não conseguir ler (câmera negada, código ilegível), a pessoa sempre
// pode digitar manualmente — este botão nunca é obrigatório.
//
// A biblioteca de leitura só é baixada quando o botão é clicado (import
// dinâmico), para não deixar o carregamento inicial do app mais pesado
// para quem nunca usa o leitor.
export default function BarcodeScannerButton({ onScan }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loadingLib, setLoadingLib] = useState(false);
  const videoRef = useRef(null);
  const controlsRef = useRef(null);

  async function handleOpen() {
    setError("");
    setLoadingLib(true);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    import("@zxing/browser")
      .then(({ BrowserMultiFormatReader }) => {
        if (cancelled) return;
        setLoadingLib(false);
        const reader = new BrowserMultiFormatReader();
        return reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current,
          (result, err, controls) => {
            controlsRef.current = controls;
            if (result && !cancelled) {
              cancelled = true;
              onScan(result.getText());
              controls.stop();
              setOpen(false);
            }
          }
        );
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingLib(false);
          setError("Não foi possível acessar a câmera. Você pode digitar o código manualmente.");
        }
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={handleOpen}>
        📷 Escanear código
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2>Escanear código</h2>
            <p className="modal-sub">Aponte a câmera para o código de barras ou QR code da etiqueta</p>

            {error ? (
              <div className="login-error">{error}</div>
            ) : (
              <>
                {loadingLib && <p className="text-muted">Abrindo câmera...</p>}
                <video
                  ref={videoRef}
                  style={{ width: "100%", borderRadius: 10, background: "#000" }}
                  muted
                  playsInline
                />
              </>
            )}

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
