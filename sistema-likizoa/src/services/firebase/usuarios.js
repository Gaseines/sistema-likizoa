import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut,
} from "firebase/auth";

import { auth, db } from "./config";

const usuariosCollection = collection(db, "usuarios");

const ROLES_VALIDAS = [
  "admin",
  "gestor",
  "operador",
  "analista",
  "assistente",
];

function normalizarRole(role) {
  const valor = String(role || "").trim().toLowerCase();
  return ROLES_VALIDAS.includes(valor) ? valor : "operador";
}

function prepararPayload(usuario) {
  return {
    nome: String(usuario.nome || "").trim(),
    email: String(usuario.email || "").trim().toLowerCase(),
    roles: normalizarRole(usuario.roles),
    ativo: usuario.ativo ?? true,
  };
}

function gerarNomeAppSecundario() {
  return `likizoa-user-create-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export async function buscarUsuarios() {
  const snapshot = await getDocs(usuariosCollection);

  const usuarios = snapshot.docs
    .map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }))
    .filter((usuario) => usuario.excluido !== true);

  return usuarios.sort((a, b) =>
    String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
      sensitivity: "base",
    }),
  );
}

export async function criarUsuario(usuario) {
  const payload = prepararPayload(usuario);
  const senha = String(usuario.senha || "");

  const nomeAppSecundario = gerarNomeAppSecundario();
  const appSecundario = initializeApp(auth.app.options, nomeAppSecundario);
  const authSecundario = getAuth(appSecundario);

  let usuarioCriadoAuth = null;

  try {
    const credenciais = await createUserWithEmailAndPassword(
      authSecundario,
      payload.email,
      senha,
    );

    usuarioCriadoAuth = credenciais.user;

    await setDoc(doc(db, "usuarios", usuarioCriadoAuth.uid), {
      ...payload,
      excluido: false,
      excluidoEm: null,
      excluidoPor: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return usuarioCriadoAuth.uid;
  } catch (error) {
    if (usuarioCriadoAuth) {
      try {
        await deleteUser(usuarioCriadoAuth);
      } catch (erroDelete) {
        console.error("ERRO ao desfazer usuário Auth:", erroDelete);
      }
    }

    throw error;
  } finally {
    try {
      await signOut(authSecundario);
    } catch {
      // ignora
    }

    try {
      await deleteApp(appSecundario);
    } catch {
      // ignora
    }
  }
}

export async function atualizarUsuario(id, usuario) {
  const payload = prepararPayload(usuario);
  const usuarioRef = doc(db, "usuarios", id);

  await updateDoc(usuarioRef, {
    nome: payload.nome,
    roles: payload.roles,
    ativo: payload.ativo,
    updatedAt: serverTimestamp(),
  });
}

export async function excluirUsuario(id, usuarioUid = null) {
  const usuarioRef = doc(db, "usuarios", id);

  await updateDoc(usuarioRef, {
    ativo: false,
    excluido: true,
    excluidoEm: serverTimestamp(),
    excluidoPor: usuarioUid,
    updatedAt: serverTimestamp(),
  });
}