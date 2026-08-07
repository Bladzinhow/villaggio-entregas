import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(traduzErro(error.message));
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role: "porteiro" } },
      });
      if (error) setError(traduzErro(error.message));
    }
    setLoading(false);
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-mark">V</div>
        <h1>Villaggio Paradiso</h1>
        <p className="login-sub">Controle de Entregas</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="field">
              <label>Seu nome</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex.: Liziane"
                required
              />
            </div>
          )}
          <div className="field">
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              required
            />
          </div>
          <div className="field">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
          <button className="btn btn-primary full-width" type="submit" disabled={loading}>
            {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <div className="login-toggle">
          {mode === "signin" ? (
            <>
              Ainda não tem conta?{" "}
              <button onClick={() => setMode("signup")}>Criar conta</button>
            </>
          ) : (
            <>
              Já tem conta?{" "}
              <button onClick={() => setMode("signin")}>Entrar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function traduzErro(msg) {
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("User already registered")) return "Já existe uma conta com este e-mail.";
  if (msg.includes("Password should be")) return "A senha precisa ter pelo menos 6 caracteres.";
  return msg;
}
