import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CourierSubmit from "./pages/CourierSubmit";
import ResetPassword from "./pages/ResetPassword";
import PickupConfirm from "./pages/PickupConfirm";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = ainda carregando
  const [profile, setProfile] = useState(null);

  // Rota pública: /nova é a tela do entregador, sem exigir login.
  // (rota simples por caminho, sem precisar de uma biblioteca de rotas)
  if (window.location.pathname === "/nova") {
    return <CourierSubmit />;
  }

  // Rota pública: /redefinir-senha é aberta pelo link do e-mail de
  // recuperação de senha. Não exige login prévio (o próprio link cria
  // uma sessão temporária).
  if (window.location.pathname === "/redefinir-senha") {
    return <ResetPassword />;
  }

  // Rota pública: /retirar é aberta pelo link enviado ao morador (e-mail
  // ou link copiado pela portaria) para confirmar a retirada sem login.
  if (window.location.pathname === "/retirar") {
    return <PickupConfirm />;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => setProfile(data));
    } else {
      setProfile(null);
    }
  }, [session]);

  if (session === undefined) {
    return null; // carregando estado inicial, evita "piscar" a tela de login
  }

  if (!session) {
    return <Login />;
  }

  return <Dashboard profile={profile} onLogout={() => supabase.auth.signOut()} />;
}
