import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "./config";

function somenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function linkValido(valor) {
  const texto = String(valor || "").trim();

  if (!texto) return false;

  try {
    const url = new URL(texto);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function buscarAcessoClientePorCnpj(cnpj) {
  const cnpjNormalizado = somenteNumeros(cnpj);

  if (cnpjNormalizado.length !== 14) {
    throw new Error("Informe um CNPJ válido.");
  }

  const clientesRef = collection(db, "clientes");

  const consulta = query(
    clientesRef,
    where("cnpj", "==", cnpjNormalizado),
    where("ativo", "==", true),
    where("clienteAcessaSistema", "==", true),
    where("excluido", "==", false),
    limit(1),
  );

  const snapshot = await getDocs(consulta);

  if (snapshot.empty) {
    throw new Error("CNPJ não encontrado ou sem acesso liberado.");
  }

  const docSnapshot = snapshot.docs[0];
  const cliente = docSnapshot.data();

  if (!linkValido(cliente.linkNossoSistema)) {
    throw new Error("Link do cliente não está disponível.");
  }

  return {
    clienteId: docSnapshot.id,
    nome: cliente.nome || "",
    url: cliente.linkNossoSistema,
  };
}