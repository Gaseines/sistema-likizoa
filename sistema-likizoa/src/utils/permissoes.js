function normalizar(valor) {
  return String(valor || "").trim().toLowerCase();
}

export function ehAdminOuGestor(usuario) {
  const perfil = normalizar(
    usuario?.tipo ||
      usuario?.perfil ||
      usuario?.role ||
      usuario?.roles ||
      usuario?.cargo ||
      usuario?.funcao ||
      usuario?.nivel
  );

  return (
    perfil === "admin" ||
    perfil === "administrador" ||
    perfil === "gestor" ||
    perfil === "gerente"
  );
}