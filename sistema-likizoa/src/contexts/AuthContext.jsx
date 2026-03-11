import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../services/firebase/config";

const AuthContext = createContext(null);

const ROLE_MODULES = {
  admin: [
    "dashboard",
    "clientes",
    "emails",
    "rastreadores",
    "usuarios",
    "links",
  ],
  gestor: [
    "dashboard",
    "clientes",
    "emails",
    "rastreadores",
    "usuarios",
    "links",
  ],
  operador: ["dashboard", "clientes", "links"],
  analista: ["dashboard", "clientes", "emails", "rastreadores", "links"],
  assistente: ["dashboard", "clientes", "rastreadores", "links"],
};

function normalizarRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase();
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      try {
        setUser(firebaseUser);

        if (!firebaseUser) {
          setUserData(null);
          return;
        }

        const internalUserData = await loadUserData(firebaseUser.uid);
        setUserData(internalUserData);
      } catch (error) {
        console.error("ERRO ao carregar usuário interno:", error);
        setUserData(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function signInUser(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function signOutUser() {
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
  }

  async function changeEmailUser(currentPassword, newEmail) {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error("Usuário não autenticado.");
    }

    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      currentPassword,
    );

    await reauthenticateWithCredential(auth.currentUser, credential);
    await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
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