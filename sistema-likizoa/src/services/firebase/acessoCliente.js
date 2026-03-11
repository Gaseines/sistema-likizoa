import { httpsCallable } from "firebase/functions";
import { functions } from "./config";

function somenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}

export async function buscarAcessoClientePorCnpj(cnpj) {
  const buscarAcesso = httpsCallable(functions, "buscarAcessoClientePorCnpj");

  const response = await buscarAcesso({
    cnpj: somenteNumeros(cnpj),
  });

  return response.data;
}