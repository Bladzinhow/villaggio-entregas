import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  function resetMessages() {
    setError("");
    setInfo("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(traduzErro(error.message));
    } else if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role: "porteiro" } },
      });

      if (error) {
        setError(traduzErro(error.message));
      } else if (data?.user && data.user.identities && data.user.identities.length === 0) {
        // O Supabase não retorna erro aqui por segurança, mas um array de
        // "identities" vazio é o sinal de que esse e-mail já tem conta.
        setError(
          "Já existe uma conta com este e-mail. Se você esqueceu a senha, use \"Esqueci minha senha\" abaixo."
        );
      } else if (data?.session) {
        // Confirmação de e-mail está desativada no Supabase: a conta já
        // entra logada automaticamente, sem precisar de mais nada.
        setInfo("Conta criada com sucesso! Entrando...");
      } else {
        // Confirmação de e-mail está ativada: a conta foi criada, mas
        // precisa confirmar o e-mail antes de conseguir entrar.
        setInfo(
          `Conta criada! Enviamos um e-mail de confirmação para ${email}. Abra esse e-mail e clique no link antes de tentar entrar.`
        );
      }
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) {
        setError(traduzErro(error.message));
      } else {
        setInfo(
          `Se ${email} tiver uma conta, enviamos um e-mail com um link para criar uma nova senha. Verifique também a caixa de spam.`
        );
      }
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
        {info && <div className="login-info">{info}</div>}

        {mode === "forgot" ? (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>E-mail da conta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                required
              />
            </div>
            <button className="btn btn-primary full-width" type="submit" disabled={loading}>
              {loading ? "Aguarde..." : "Enviar link de recuperação"}
            </button>
          </form>
        ) : (
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
        )}

        <div className="login-toggle">
          {mode === "signin" && (
            <>
              Ainda não tem conta?{" "}
              <button
                onClick={() => {
                  resetMessages();
                  setMode("signup");
                }}
              >
                Criar conta
              </button>
              <br />
              Esqueceu a senha?{" "}
              <button
                onClick={() => {
                  resetMessages();
                  setMode("forgot");
                }}
              >
                Recuperar senha
              </button>
            </>
          )}
          {mode === "signup" && (
            <>
              Já tem conta?{" "}
              <button
                onClick={() => {
                  resetMessages();
                  setMode("signin");
                }}
              >
                Entrar
              </button>
            </>
          )}
          {mode === "forgot" && (
            <>
              Lembrou a senha?{" "}
              <button
                onClick={() => {
                  resetMessages();
                  setMode("signin");
                }}
              >
                Voltar para o login
              </button>
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
  if (msg.includes("rate limit")) return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  if (msg.includes("Email not confirmed")) return "Este e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
  return msg;
}
