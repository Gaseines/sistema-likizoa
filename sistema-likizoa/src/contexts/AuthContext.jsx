import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

import { auth, db } from "../services/firebase/config";

const AuthContext = createContext(null);

const ROLE_MODULES = {
  admin: [
    "dashboard",
    "clientes",
    "emails",
    "rastreadores",
    "links",
    "recados",
    "usuarios",
  ],
  gestor: [
    "dashboard",
    "clientes",
    "emails",
    "rastreadores",
    "links",
    "recados",
    "usuarios",
  ],
  operador: ["dashboard", "clientes", "links", "rastreadores"],
  analista: ["dashboard", "clientes", "emails", "rastreadores", "links"],
  assistente: ["dashboard", "clientes", "rastreadores", "links"],
};

const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 1 hora
const LAST_ACTIVITY_KEY = "likizoa_last_activity_at";

function normalizarRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase();
}

function normalizarEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function obterUltimaAtividade() {
  const valor = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(valor) ? valor : 0;
}

function registrarAtividade() {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

function limparUltimaAtividade() {
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

function sessaoExpiradaPorInatividade() {
  const ultimaAtividade = obterUltimaAtividade();

  if (!ultimaAtividade) {
    return false;
  }

  return Date.now() - ultimaAtividade > INACTIVITY_LIMIT_MS;
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const inactivityTimeoutRef = useRef(null);

  async function loadUserData(uid) {
    const userRef = doc(db, "usuarios", uid);
    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists()) {
      return null;
    }

    return {
      id: userSnapshot.id,
      ...userSnapshot.data(),
    };
  }

  async function sincronizarEmailFirestore(firebaseUser, internalUserData) {
    if (!firebaseUser?.uid || !internalUserData) {
      return internalUserData;
    }

    const emailAuth = normalizarEmail(firebaseUser.email);
    const emailFirestore = normalizarEmail(internalUserData.email);

    if (!emailAuth || emailAuth === emailFirestore) {
      return internalUserData;
    }

    const userRef = doc(db, "usuarios", firebaseUser.uid);

    await updateDoc(userRef, {
      email: emailAuth,
      updatedAt: serverTimestamp(),
    });

    return {
      ...internalUserData,
      email: emailAuth,
    };
  }

  function limparTimerInatividade() {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  }

  async function encerrarSessaoPorInatividade() {
    try {
      limparTimerInatividade();
      limparUltimaAtividade();
      await signOut(auth);
    } catch (error) {
      console.error("ERRO ao encerrar sessão por inatividade:", error);
    }
  }

  function reiniciarTimerInatividade() {
    limparTimerInatividade();

    const ultimaAtividade = obterUltimaAtividade();

    if (!ultimaAtividade || !auth.currentUser) {
      return;
    }

    const tempoRestante = INACTIVITY_LIMIT_MS - (Date.now() - ultimaAtividade);

    if (tempoRestante <= 0) {
      encerrarSessaoPorInatividade();
      return;
    }

    inactivityTimeoutRef.current = setTimeout(() => {
      encerrarSessaoPorInatividade();
    }, tempoRestante);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      try {
        setUser(firebaseUser);

        if (!firebaseUser) {
          setUserData(null);
          limparTimerInatividade();
          return;
        }

        if (sessaoExpiradaPorInatividade()) {
          await encerrarSessaoPorInatividade();
          setUser(null);
          setUserData(null);
          return;
        }

        registrarAtividade();
        reiniciarTimerInatividade();

        const internalUserData = await loadUserData(firebaseUser.uid);
        const internalUserDataSincronizado = await sincronizarEmailFirestore(
          firebaseUser,
          internalUserData,
        );

        setUserData(internalUserDataSincronizado);
      } catch (error) {
        console.error("ERRO ao carregar usuário interno:", error);
        setUserData(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      limparTimerInatividade();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let ultimoRegistro = 0;

    function marcarAtividade() {
      const agora = Date.now();

      // evita gravar no localStorage o tempo todo
      if (agora - ultimoRegistro < 15000) {
        reiniciarTimerInatividade();
        return;
      }

      ultimoRegistro = agora;
      registrarAtividade();
      reiniciarTimerInatividade();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        if (sessaoExpiradaPorInatividade()) {
          encerrarSessaoPorInatividade();
          return;
        }

        marcarAtividade();
      }
    }

    const eventos = [
      "click",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
    ];

    eventos.forEach((evento) => {
      window.addEventListener(evento, marcarAtividade, { passive: true });
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // garante que ao logar já fique registrado
    registrarAtividade();
    reiniciarTimerInatividade();

    return () => {
      eventos.forEach((evento) => {
        window.removeEventListener(evento, marcarAtividade);
      });

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  async function signInUser(email, password) {
    const credencial = await signInWithEmailAndPassword(auth, email, password);
    registrarAtividade();
    reiniciarTimerInatividade();
    return credencial;
  }

  async function signOutUser() {
    limparTimerInatividade();
    limparUltimaAtividade();
    await signOut(auth);
  }

  async function changePasswordUser(currentPassword, newPassword) {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error("Usuário não autenticado.");
    }

    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      currentPassword,
    );

    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
    registrarAtividade();
    reiniciarTimerInatividade();
  }

  async function changeEmailUser(currentPassword, newEmail) {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error("Usuário não autenticado.");
    }

    const novoEmailNormalizado = normalizarEmail(newEmail);

    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      currentPassword,
    );

    await reauthenticateWithCredential(auth.currentUser, credential);
    await verifyBeforeUpdateEmail(auth.currentUser, novoEmailNormalizado);
    registrarAtividade();
    reiniciarTimerInatividade();
  }

  function hasPermission(moduleKey) {
    if (!user || !userData?.ativo) {
      return false;
    }

    if (!moduleKey) {
      return true;
    }

    const role = normalizarRole(userData?.roles);
    const allowedModules = ROLE_MODULES[role] || [];

    return allowedModules.includes(moduleKey);
  }

  const value = useMemo(
    () => ({
      user,
      userData,
      loading,
      signInUser,
      signOutUser,
      changePasswordUser,
      changeEmailUser,
      hasPermission,
    }),
    [user, userData, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth precisa ser usado dentro de AuthProvider");
  }

  return context;
}

export { AuthProvider, useAuth };