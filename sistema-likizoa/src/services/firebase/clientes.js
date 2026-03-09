import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";

import { db } from "./config";

const clientesCollection = collection(db, "clientes");

function somenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function prepararPayload(cliente) {
  return {
    nome: String(cliente.nome || "").trim(),
    cnpj: somenteNumeros(cliente.cnpj),
    tipoProcessamento: String(cliente.tipoProcessamento || "").trim(),
    folgaFora: Boolean(cliente.folgaFora),
    temDiarias: Boolean(cliente.temDiarias),
    operador: String(cliente.operador || "").trim(),
    assistente: String(cliente.assistente || "").trim(),
    analista: String(cliente.analista || "").trim(),
    envioSemanal: Boolean(cliente.envioSemanal),
    dataCorteDia: Number(cliente.dataCorteDia),
    observacao: String(cliente.observacao || "").trim(),
    clienteAcessaSistema: Boolean(cliente.clienteAcessaSistema),
    regraEspecifica: String(cliente.regraEspecifica || "").trim(),
    ativo: cliente.ativo ?? true,
  };
}

export async function buscarClientes() {
  const snapshot = await getDocs(clientesCollection);

  const clientes = snapshot.docs
    .map((documento) => ({
      id: documento.id,
      ...documento.data(),
    }))
    .filter((cliente) => cliente.excluido !== true);

  return clientes.sort((a, b) =>
    String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
      sensitivity: "base",
    }),
  );
}

export async function criarCliente(cliente) {
  const payload = prepararPayload(cliente);

  await addDoc(clientesCollection, {
    ...payload,
    excluido: false,
    excluidoEm: null,
    excluidoPor: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function atualizarCliente(id, cliente) {
  const payload = prepararPayload(cliente);

  const clienteRef = doc(db, "clientes", id);

  await updateDoc(clienteRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function excluirCliente(id, usuarioUid = null) {
  const clienteRef = doc(db, "clientes", id);

  await updateDoc(clienteRef, {
    excluido: true,
    excluidoEm: serverTimestamp(),
    excluidoPor: usuarioUid,
    updatedAt: serverTimestamp(),
  });
}