import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../services/firebase/config";

const AuthContext = createContext(null);

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

  function hasPermission(moduleKey) {
    if (!user || !userData?.ativo) {
      return false;
    }

    if (!moduleKey) {
      return true;
    }

    return Boolean(userData?.permissoes?.[moduleKey]);
  }

  const value = useMemo(
    () => ({
      user,
      userData,
      loading,
      signInUser,
      signOutUser,
      hasPermission,
    }),
    [user, userData, loading]
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