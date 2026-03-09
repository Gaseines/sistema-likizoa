import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "./config";

const emailsCollection = collection(db, "emails_clientes");

function normalizarEmails(valor) {
  if (Array.isArray(valor)) {
    return [...new Set(valor.map((email) => String(email).trim()).filter(Boolean))];
  }

  return [...new Set(
    String(valor || "")
      .split(/[\n,;]+/)
      .map((email) => email.trim())
      .filter(Boolean)
  )];
}

function prepararPayload(registro) {
  return {
    clienteId: String(registro.clienteId || "").trim(),
    clienteNome: String(registro.clienteNome || "").trim(),
    emails: normalizarEmails(registro.emails),
    ativo: registro.ativo ?? true,
  };
}

export async function buscarEmailsClientes() {
  const snapshot = await getDocs(emailsCollection);

  const registros = snapshot.docs.map((documento) => ({
    id: documento.id,
    ...documento.data(),
  }));

  return registros.sort((a, b) =>
    String(a.clienteNome || "").localeCompare(String(b.clienteNome || ""), "pt-BR", {
      sensitivity: "base",
    })
  );
}

export async function criarEmailsCliente(registro) {
  const payload = prepararPayload(registro);

  await addDoc(emailsCollection, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function atualizarEmailsCliente(id, registro) {
  const payload = prepararPayload(registro);

  const registroRef = doc(db, "emails_clientes", id);

  await updateDoc(registroRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}