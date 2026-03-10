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

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function prepararPayload(registro) {
  return {
    clienteId: normalizarTexto(registro.clienteId),
    clienteNome: normalizarTexto(registro.clienteNome),
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
    const clienteA = String(a.clienteNome || "");
    const clienteB = String(b.clienteNome || "");

    const comparacaoCliente = clienteA.localeCompare(clienteB, "pt-BR", {
      sensitivity: "base",
    });

    if (comparacaoCliente !== 0) {
      return comparacaoCliente;
    }

    return String(a.rastreador || a.nome || "")
      .localeCompare(String(b.rastreador || b.nome || ""), "pt-BR", {
        sensitivity: "base",
      });
  });
}

export async function buscarRastreadores({
  isAdminOuGestor = false,
  clienteIds = [],
} = {}) {
  let registros = [];

  if (isAdminOuGestor) {
    const snapshot = await getDocs(rastreadoresCollection);

    registros = snapshot.docs.map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }));
  } else {
    const idsValidos = [...new Set(clienteIds.filter(Boolean))];

    if (idsValidos.length === 0) {
      return [];
    }

    const consultas = await Promise.all(
      idsValidos.map((clienteId) =>
        getDocs(query(rastreadoresCollection, where("clienteId", "==", clienteId))),
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
      registro.excluido !== true &&
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