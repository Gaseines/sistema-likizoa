const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

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

exports.buscarAcessoClientePorCnpj = onCall({ cors: true }, async (request) => {
  const cnpj = String(request.data?.cnpj || "").replace(/\D/g, "");

  if (!cnpj || cnpj.length !== 14) {
    throw new HttpsError("invalid-argument", "Informe um CNPJ válido.");
  }

  const snapshot = await admin
    .firestore()
    .collection("clientes")
    .where("cnpj", "==", cnpj)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new HttpsError(
      "not-found",
      "CNPJ não encontrado ou sem acesso liberado.",
    );
  }

  const doc = snapshot.docs[0];
  const cliente = doc.data();

  if (cliente.excluido === true) {
    throw new HttpsError("permission-denied", "Cliente sem acesso liberado.");
  }

  if (cliente.ativo === false) {
    throw new HttpsError("permission-denied", "Cliente inativo no sistema.");
  }

  if (cliente.clienteAcessaSistema !== true) {
    throw new HttpsError("permission-denied", "Cliente sem acesso liberado.");
  }

  if (!linkValido(cliente.linkNossoSistema)) {
    throw new HttpsError(
      "failed-precondition",
      "Link do cliente não está disponível.",
    );
  }

  return {
    clienteId: doc.id,
    nome: cliente.nome || "",
    url: cliente.linkNossoSistema,
    ok: true,
  };
});
