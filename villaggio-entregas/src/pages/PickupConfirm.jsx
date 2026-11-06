import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// Tela pública aberta pelo link enviado por e-mail (ou copiado manualmente
// pela portaria) para o morador confirmar que já retirou a encomenda —
// sem precisar de login. Só funciona com o token exato da encomenda.
export default function PickupConfirm() {
  const [status, setStatus] = useState("loading"); // loading | found | not_found | confirmed | already | error
  const [pkg, setPkg] = useState(null);
  const [pickedUpBy, setPickedUpBy] = useState("");
  const [saving, setSaving] = useState(false);

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    if (!token) {
      setStatus("not_found");
      return;
    }
    supabase
      .rpc("get_package_by_pickup_token", { p_token: token })
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          setStatus("not_found");
          return;
        }
        const row = data[0];
        setPkg(row);
        setStatus(row.status === "entregue" ? "already" : "found");
      });
  }, [token]);

  async function handleConfirm(e) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase.rpc("confirm_pickup_by_token", {
      p_token: token,
      p_picked_up_by: pickedUpBy,
    });
    setSaving(false);
    if (error || !data) {
      setStatus("error");
      return;
    }
    setStatus("confirmed");
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-mark">V</div>
        <h1>Villaggio Paradiso</h1>
        <p className="login-sub">Confirmar retirada da encomenda</p>

        {status === "loading" && <p className="login-info">Carregando...</p>}

        {status === "not_found" && (
          <div className="login-error">
            Não encontramos essa encomenda. O link pode estar incompleto — confira se copiou o endereço inteiro, ou
            procure a portaria.
          </div>
        )}

        {status === "already" && pkg && (
          <div className="login-info">
            Essa encomenda ({pkg.carrier} — {pkg.recipient_name}) já foi marcada como retirada. Se isso não foi você,
            procure a portaria.
          </div>
        )}

        {status === "found" && pkg && (
          <form onSubmit={handleConfirm}>
            <div className="login-info">
              Encomenda da <strong>{pkg.carrier}</strong> para <strong>{pkg.recipient_name}</strong>
              {" — "}{pkg.street}{pkg.house_number ? `, ${pkg.house_number}` : ""}
            </div>
            <div className="field">
              <label>Seu nome (para o registro da portaria)</label>
              <input
                autoFocus
                value={pickedUpBy}
                onChange={(e) => setPickedUpBy(e.target.value)}
                placeholder="Ex.: Maria"
                required
              />
            </div>
            <button className="btn btn-primary full-width" type="submit" disabled={saving}>
              {saving ? "Confirmando..." : "Confirmar que já retirei"}
            </button>
          </form>
        )}

        {status === "confirmed" && (
          <div className="login-info">Retirada confirmada! Obrigado. 📦</div>
        )}

        {status === "error" && (
          <div className="login-error">
            Não foi possível confirmar agora. Tente novamente ou procure a portaria.
          </div>
        )}
      </div>
    </div>
  );
}
