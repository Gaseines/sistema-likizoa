import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  doc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";

import { db } from "./config";

const clientesCollection = collection(db, "clientes");

function somenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase();
}

function prepararPayload(cliente) {
  const operadorNome = String(cliente.operadorNome || "").trim();
  const operador2Nome = String(cliente.operador2Nome || "").trim();
  const assistenteNome = String(cliente.assistenteNome || "").trim();
  const analistaNome = String(cliente.analistaNome || "").trim();

  return {
    nome: String(cliente.nome || "").trim(),
    cnpj: somenteNumeros(cliente.cnpj),
    tipoProcessamento: String(cliente.tipoProcessamento || "").trim(),
    folgaFora: Boolean(cliente.folgaFora),
    temDiarias: Boolean(cliente.temDiarias),

    operadorId: String(cliente.operadorId || "").trim(),
    operadorNome,
    operador: operadorNome,

    operador2Id: String(cliente.operador2Id || "").trim(),
    operador2Nome,
    operador2: operador2Nome,

    assistenteId: String(cliente.assistenteId || "").trim(),
    assistenteNome,
    assistente: assistenteNome,

    analistaId: String(cliente.analistaId || "").trim(),
    analistaNome,
    analista: analistaNome,

    envioSemanal: Boolean(cliente.envioSemanal),
    dataCorteDia: Number(cliente.dataCorteDia),
    observacao: String(cliente.observacao || "").trim(),
    clienteAcessaSistema: Boolean(cliente.clienteAcessaSistema),
    linkNossoSistema: String(cliente.linkNossoSistema || "").trim(),
    regraEspecifica: String(cliente.regraEspecifica || "").trim(),
    ativo: cliente.ativo ?? true,
  };
}

export async function buscarClientes({ role, uid, isAdminOuGestor } = {}) {
  const roleNormalizada = normalizarTexto(role);

  if (!isAdminOuGestor && uid && roleNormalizada === "operador") {
    const [snapshotOperador1, snapshotOperador2] = await Promise.all([
      getDocs(query(clientesCollection, where("operadorId", "==", uid))),
      getDocs(query(clientesCollection, where("operador2Id", "==", uid))),
    ]);

    const clientesMap = new Map();

    [...snapshotOperador1.docs, ...snapshotOperador2.docs].forEach((documento) => {
      const cliente = {
        id: documento.id,
        ...documento.data(),
      };

      if (cliente.excluido !== true) {
        clientesMap.set(cliente.id, cliente);
      }
    });

    return Array.from(clientesMap.values()).sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
        sensitivity: "base",
      }),
    );
  }

  let consulta = clientesCollection;

  if (!isAdminOuGestor && uid) {
    if (roleNormalizada === "analista") {
      consulta = query(clientesCollection, where("analistaId", "==", uid));
    } else if (roleNormalizada === "assistente") {
      consulta = query(clientesCollection, where("assistenteId", "==", uid));
    }
  }

  const snapshot = await getDocs(consulta);

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