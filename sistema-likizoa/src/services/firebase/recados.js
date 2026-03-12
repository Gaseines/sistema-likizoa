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

const recadosCollection = collection(db, "recados");

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function normalizarTipo(tipo) {
  const valor = normalizarTexto(tipo).toLowerCase();
  return valor === "cliente" ? "cliente" : "dashboard";
}

function normalizarRole(role) {
  const valor = normalizarTexto(role).toLowerCase();

  if (["operador", "analista", "assistente"].includes(valor)) {
    return valor;
  }

  return "";
}

function obterTimestampEmMs(valor) {
  if (!valor) return 0;

  if (typeof valor?.toMillis === "function") {
    return valor.toMillis();
  }

  if (valor instanceof Date) {
    return valor.getTime();
  }

  return 0;
}

function prepararPayload(recado) {
  return {
    tipo: normalizarTipo(recado.tipo),
    clienteId: normalizarTexto(recado.clienteId),
    clienteNome: normalizarTexto(recado.clienteNome),

    destinatarioUid: normalizarTexto(recado.destinatarioUid),
    destinatarioNome: normalizarTexto(recado.destinatarioNome),
    destinatarioRole: normalizarRole(recado.destinatarioRole),

    referenciaVinculo: normalizarTexto(recado.referenciaVinculo).toLowerCase(),

    titulo: normalizarTexto(recado.titulo),
    mensagem: normalizarTexto(recado.mensagem),

    ativo: recado.ativo ?? true,

    createdByUid: normalizarTexto(recado.createdByUid),
    createdByNome: normalizarTexto(recado.createdByNome),
  };
}

function ordenarRecados(lista) {
  return [...lista].sort((a, b) => {
    const updatedB = obterTimestampEmMs(b.updatedAt);
    const updatedA = obterTimestampEmMs(a.updatedAt);

    if (updatedB !== updatedA) {
      return updatedB - updatedA;
    }

    const createdB = obterTimestampEmMs(b.createdAt);
    const createdA = obterTimestampEmMs(a.createdAt);

    if (createdB !== createdA) {
      return createdB - createdA;
    }

    return String(a.destinatarioNome || "").localeCompare(
      String(b.destinatarioNome || ""),
      "pt-BR",
      { sensitivity: "base" },
    );
  });
}

export async function buscarRecados({
  tipo = "",
  destinatarioUid = "",
  clienteId = "",
  somenteAtivos = false,
} = {}) {
  let snapshot;

  if (destinatarioUid) {
    snapshot = await getDocs(
      query(recadosCollection, where("destinatarioUid", "==", destinatarioUid)),
    );
  } else {
    snapshot = await getDocs(recadosCollection);
  }

  const recados = snapshot.docs
    .map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }))
    .filter((recado) => recado.excluido !== true)
    .filter((recado) => {
      if (tipo && String(recado.tipo || "").toLowerCase() !== String(tipo).toLowerCase()) {
        return false;
      }

      if (clienteId && String(recado.clienteId || "") !== String(clienteId)) {
        return false;
      }

      if (somenteAtivos && recado.ativo !== true) {
        return false;
      }

      return true;
    });

  return ordenarRecados(recados);
}

export async function criarRecado(recado) {
  const payload = prepararPayload(recado);

  await addDoc(recadosCollection, {
    ...payload,
    excluido: false,
    excluidoEm: null,
    excluidoPor: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function atualizarRecado(id, recado) {
  const payload = prepararPayload(recado);
  const recadoRef = doc(db, "recados", id);

  await updateDoc(recadoRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function excluirRecado(id, usuarioUid = null) {
  const recadoRef = doc(db, "recados", id);

  await updateDoc(recadoRef, {
    excluido: true,
    excluidoEm: serverTimestamp(),
    excluidoPor: usuarioUid,
    updatedAt: serverTimestamp(),
  });
}