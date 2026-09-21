import express from "express";
import bcrypt from "bcryptjs";
import { adminClient } from "../supabase.js";

const router = express.Router();

/* ============================================================
   CRIAR PEDIDO DE CADASTRO
   ============================================================ */
router.post("/", async (req, res) => {
  const { nome, email, senha, tipo, foto_url } = req.body;

  if (!nome || !email || !senha || !tipo) {
    return res.status(400).json({ erro: "Nome, email, senha e tipo obrigatórios" });
  }
  if (!["professor", "funcionario"].includes(tipo)) {
    return res.status(400).json({ erro: "Tipo inválido" });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    // Verifica se já existe user
    const { data: userExist } = await adminClient
      .from("users")
      .select("id")
      .eq("email", emailLower)
      .maybeSingle();

    if (userExist) {
      return res.status(400).json({ erro: "Este email já está cadastrado" });
    }

    // Verifica se já tem pedido
    const { data: pedidoExist } = await adminClient
      .from("pedidos_cadastro")
      .select("id, status")
      .eq("email", emailLower)
      .maybeSingle();

    if (pedidoExist) {
      if (pedidoExist.status === "pendente") {
        return res.status(400).json({ erro: "Você já tem um pedido pendente" });
      }
      if (pedidoExist.status === "rejeitado") {
        await adminClient.from("pedidos_cadastro").delete().eq("id", pedidoExist.id);
      }
      if (pedidoExist.status === "aprovado") {
        return res.status(400).json({ erro: "Seu cadastro já foi aprovado. Faça login." });
      }
    }

    const senha_hash = bcrypt.hashSync(senha, 10);

    const { data, error } = await adminClient
      .from("pedidos_cadastro")
      .insert([{
        nome: nome.trim(),
        email: emailLower,
        senha_hash,
        tipo,
        foto_url: foto_url || null,
        status: "pendente",
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ erro: error.message });

    res.json({
      ok: true,
      mensagem: "Pedido enviado! Aguarde aprovação do administrador.",
      pedido: { id: data.id, status: data.status },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message });
  }
});

/* ============================================================
   LISTAR PEDIDOS (admin)
   ============================================================ */
router.get("/", async (req, res) => {
  const { status = "pendente" } = req.query;

  let query = adminClient
    .from("pedidos_cadastro")
    .select("*")
    .order("criado_em", { ascending: false });

  if (status !== "todos") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

/* ============================================================
   APROVAR
   ============================================================ */
router.post("/:id/aprovar", async (req, res) => {
  const { id } = req.params;

  try {
    const { data: pedido } = await adminClient
      .from("pedidos_cadastro")
      .select("*")
      .eq("id", id)
      .single();

    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });
    if (pedido.status !== "pendente") {
      return res.status(400).json({ erro: "Este pedido já foi analisado" });
    }

    const { error: errUser } = await adminClient
      .from("users")
      .insert([{
        email: pedido.email,
        nome: pedido.nome,
        senha_hash: pedido.senha_hash,
        tipo: pedido.tipo,
        foto_url: pedido.foto_url,
        ativo: true,
        aprovado: true,
        aprovado_em: new Date().toISOString(),
      }]);

    if (errUser) return res.status(500).json({ erro: errUser.message });

    await adminClient
      .from("pedidos_cadastro")
      .update({ status: "aprovado", analisado_em: new Date().toISOString() })
      .eq("id", id);

    res.json({ ok: true, mensagem: "Cadastro aprovado!" });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

/* ============================================================
   REJEITAR
   ============================================================ */
router.post("/:id/rejeitar", async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  const { error } = await adminClient
    .from("pedidos_cadastro")
    .update({
      status: "rejeitado",
      motivo_rejeicao: motivo || "Sem motivo informado",
      analisado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

export default router;
