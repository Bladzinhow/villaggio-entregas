import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// Tela aberta pelo link de "recuperar senha" enviado por e-mail.
// O Supabase processa o token que vem na própria URL e dispara o evento
// PASSWORD_RECOVERY; a partir daí já existe uma sessão temporária que
// permite trocar a senha com updateUser, sem precisar da senha antiga.
export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Caso o evento já tenha disparado antes deste componente montar,
    // uma sessão válida nessa página também libera o formulário.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 2500);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-mark">V</div>
        <h1>Villaggio Paradiso</h1>
        <p className="login-sub">Criar nova senha</p>

        {!ready && !done && (
          <p className="login-info">
            Abrindo o link de recuperação... Se esta mensagem não mudar em alguns
            segundos, o link pode ter expirado. Volte para a tela de login e peça um
            novo link em "Esqueci minha senha".
          </p>
        )}

        {ready && !done && (
          <form onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}
            <div className="field">
              <label>Nova senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>
            <div className="field">
              <label>Confirmar nova senha</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>
            <button className="btn btn-primary full-width" type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}

        {done && (
          <div className="login-info">
            Senha alterada com sucesso! Você já está logado — redirecionando...
          </div>
        )}
      </div>
    </div>
  );
}
