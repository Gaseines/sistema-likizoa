import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "./config";

const rastreadoresCollection = collection(db, "rastreadores");

export const CLIENTE_NOSSO_ACESSO_ID = "__nosso_acesso__";
export const CLIENTE_NOSSO_ACESSO_NOME = "Nosso acesso";

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function ehNossoAcesso(registro) {
  return (
    normalizarTexto(registro?.clienteId) === CLIENTE_NOSSO_ACESSO_ID ||
    normalizarTexto(registro?.clienteNome).toLowerCase() ===
      CLIENTE_NOSSO_ACESSO_NOME.toLowerCase()
  );
}

function prepararPayload(registro) {
  const clienteId = normalizarTexto(registro.clienteId);
  const clienteNome = normalizarTexto(registro.clienteNome);

  const ehRegistroNossoAcesso =
    clienteId === CLIENTE_NOSSO_ACESSO_ID ||
    clienteNome.toLowerCase() === CLIENTE_NOSSO_ACESSO_NOME.toLowerCase();

  return {
    clienteId: ehRegistroNossoAcesso ? CLIENTE_NOSSO_ACESSO_ID : clienteId,
    clienteNome: ehRegistroNossoAcesso
      ? CLIENTE_NOSSO_ACESSO_NOME
      : clienteNome,
    rastreador: normalizarTexto(registro.rastreador),
    email: normalizarTexto(registro.email),
    login: normalizarTexto(registro.login),
    senha: normalizarTexto(registro.senha),
    linkAcesso: normalizarTexto(registro.linkAcesso),
    ativo: registro.ativo ?? true,
  };
}

function ordenarRegistros(registros) {
  return registros.sort((a, b) => {
    const aNossoAcesso = ehNossoAcesso(a);
    const bNossoAcesso = ehNossoAcesso(b);

    if (aNossoAcesso !== bNossoAcesso) {
      return aNossoAcesso ? -1 : 1;
    }

    const comparacaoCliente = String(a.clienteNome || "").localeCompare(
      String(b.clienteNome || ""),
      "pt-BR",
      {
        sensitivity: "base",
      },
    );

    if (comparacaoCliente !== 0) {
      return comparacaoCliente;
    }

    return String(a.rastreador || a.nome || "").localeCompare(
      String(b.rastreador || b.nome || ""),
      "pt-BR",
      {
        sensitivity: "base",
      },
    );
  });
}

export async function buscarRastreadores({
  isAdminOuGestor = false,
  clienteIds = [],
} = {}) {
  let registros = [];

  if (isAdminOuGestor) {
    const snapshot = await getDocs(
      query(rastreadoresCollection, where("excluido", "==", false)),
    );

    registros = snapshot.docs.map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }));
  } else {
    const idsValidos = [
      ...new Set([CLIENTE_NOSSO_ACESSO_ID, ...clienteIds.filter(Boolean)]),
    ];

    if (idsValidos.length === 0) {
      return [];
    }

    const consultas = await Promise.all(
      idsValidos.map((clienteId) =>
        getDocs(
          query(
            rastreadoresCollection,
            where("clienteId", "==", clienteId),
            where("excluido", "==", false),
          ),
        ),
      ),
    );

    registros = consultas.flatMap((snapshot) =>
      snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      })),
    );
  }

  const registrosUnicos = registros.filter(
    (registro, index, array) =>
      array.findIndex((item) => item.id === registro.id) === index,
  );

  return ordenarRegistros(registrosUnicos);
}

export async function criarRastreador(registro) {
  const payload = prepararPayload(registro);

  await addDoc(rastreadoresCollection, {
    ...payload,
    excluido: false,
    excluidoEm: null,
    excluidoPor: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function atualizarRastreador(id, registro) {
  const payload = prepararPayload(registro);

  const registroRef = doc(db, "rastreadores", id);

  await updateDoc(registroRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function excluirRastreador(id, usuarioUid = null) {
  const registroRef = doc(db, "rastreadores", id);

  await updateDoc(registroRef, {
    excluido: true,
    excluidoEm: serverTimestamp(),
    excluidoPor: usuarioUid,
    updatedAt: serverTimestamp(),
  });
}