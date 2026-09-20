import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const SECRET = process.env.JWT_SECRET || "dev-secret";
const TTL = "8h";

export const hashSenha = (s) => bcrypt.hashSync(s, 10);
export const verificarSenha = (s, h) => bcrypt.compareSync(s, h);

export function gerarToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, tipo: user.tipo, nome: user.nome },
    SECRET,
    { expiresIn: TTL }
  );
}

export function middlewareAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ erro: "Não autenticado" });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { return res.status(401).json({ erro: "Sessão expirada" }); }
}

export function middlewareAdmin(req, res, next) {
  if (req.user?.tipo !== "admin") return res.status(403).json({ erro: "Só admin" });
  next();
}

export function middlewareFuncionario(req, res, next) {
  if (!["admin", "funcionario"].includes(req.user?.tipo))
    return res.status(403).json({ erro: "Acesso restrito" });
  next();
}
