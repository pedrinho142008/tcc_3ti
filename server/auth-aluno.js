import jwt from "jsonwebtoken";

const SECRET =
  process.env.JWT_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  "dev-secret-mude-isto";

/* Aceita tanto token de admin quanto token_aluno */
export function middlewareAlunoOuAdmin(req, res, next) {
  // Tenta o cookie de admin primeiro
  const tokenAdmin = req.cookies?.token;
  const tokenAluno = req.cookies?.token_aluno;

  if (tokenAdmin) {
    try {
      req.user = jwt.verify(tokenAdmin, SECRET);
      return next();
    } catch {}
  }

  if (tokenAluno) {
    try {
      const payload = jwt.verify(tokenAluno, SECRET);
      req.user = { ...payload, tipo: "aluno" };
      return next();
    } catch {}
  }

  return res.status(401).json({ erro: "Não autenticado" });
}

/* Só aluno (token_aluno) */
export function middlewareAluno(req, res, next) {
  const token = req.cookies?.token_aluno;
  if (!token) return res.status(401).json({ erro: "Não autenticado" });

  try {
    const payload = jwt.verify(token, SECRET);
    req.user = { ...payload, tipo: "aluno" };
    next();
  } catch {
    return res.status(401).json({ erro: "Sessão expirada" });
  }
}
