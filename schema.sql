--
-- PostgreSQL database dump
--

\restrict k3dcKbtb5cHuJeG0cSKHjJwgr1y0tWVtyeDE5Loxu72s0fo9IUm74xvAAqY6XDR

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: atualizar_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;


--
-- Name: atualizar_timestamp_mod(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_timestamp_mod() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: acoes_risco; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acoes_risco (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_matricula text NOT NULL,
    tipo text NOT NULL,
    descricao text,
    autor_id uuid,
    autor_nome text,
    status text DEFAULT 'pendente'::text,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT acoes_risco_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'em_andamento'::text, 'concluida'::text]))),
    CONSTRAINT acoes_risco_tipo_check CHECK ((tipo = ANY (ARRAY['contato_pais'::text, 'reuniao'::text, 'encaminhamento'::text, 'tutoria'::text, 'outro'::text])))
);


--
-- Name: alertas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alertas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_matricula text,
    aluno_nome text,
    turma text,
    tipo text NOT NULL,
    titulo text NOT NULL,
    descricao text,
    severidade text DEFAULT 'media'::text,
    lido boolean DEFAULT false,
    destinatario_tipo text NOT NULL,
    destinatario_id text,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT alertas_destinatario_tipo_check CHECK ((destinatario_tipo = ANY (ARRAY['aluno'::text, 'professor'::text, 'admin'::text]))),
    CONSTRAINT alertas_severidade_check CHECK ((severidade = ANY (ARRAY['baixa'::text, 'media'::text, 'alta'::text, 'critica'::text]))),
    CONSTRAINT alertas_tipo_check CHECK ((tipo = ANY (ARRAY['nota_baixa'::text, 'queda_nota'::text, 'frequencia_baixa'::text, 'sem_entrega'::text, 'elogio'::text])))
);


--
-- Name: alunos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alunos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    matricula text NOT NULL,
    nome text,
    turma text,
    serie text,
    turno text,
    foto_url text,
    perfil jsonb DEFAULT '{}'::jsonb,
    boletim jsonb DEFAULT '{}'::jsonb,
    atualizado_em timestamp with time zone DEFAULT now(),
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: analises_plagio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analises_plagio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    envio_id_1 uuid,
    envio_id_2 uuid,
    aluno_1 text,
    aluno_2 text,
    turma text,
    atividade_id uuid,
    similaridade numeric(5,2),
    texto_1 text,
    texto_2 text,
    analisado_em timestamp with time zone DEFAULT now()
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    texto text NOT NULL,
    urgente boolean DEFAULT false,
    ativo boolean DEFAULT true,
    autor_id uuid,
    criado_em timestamp with time zone DEFAULT now(),
    expira_em timestamp with time zone
);


--
-- Name: atividades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atividades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    professor_id uuid,
    professor_nome text,
    titulo text NOT NULL,
    descricao text,
    turma text NOT NULL,
    arquivo_url text,
    arquivo_tipo text,
    prazo timestamp with time zone,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: atividades_turma; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atividades_turma (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    professor_id uuid,
    professor_nome text,
    turma text NOT NULL,
    titulo text NOT NULL,
    descricao text,
    arquivo_url text,
    arquivo_tipo text,
    arquivo_nome text,
    prazo timestamp with time zone,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now()
);


--
-- Name: comentarios_atividade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comentarios_atividade (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    atividade_id uuid,
    autor_tipo text NOT NULL,
    autor_nome text NOT NULL,
    autor_matricula text,
    autor_id uuid,
    texto text NOT NULL,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT comentarios_atividade_autor_tipo_check CHECK ((autor_tipo = ANY (ARRAY['aluno'::text, 'professor'::text, 'admin'::text])))
);


--
-- Name: atividades_com_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.atividades_com_stats AS
 SELECT a.id,
    a.professor_id,
    a.professor_nome,
    a.turma,
    a.titulo,
    a.descricao,
    a.arquivo_url,
    a.arquivo_tipo,
    a.arquivo_nome,
    a.prazo,
    a.ativo,
    a.criado_em,
    a.atualizado_em,
    COALESCE(c.total_comentarios, (0)::bigint) AS total_comentarios,
    c.ultimo_comentario
   FROM (public.atividades_turma a
     LEFT JOIN ( SELECT comentarios_atividade.atividade_id,
            count(*) AS total_comentarios,
            max(comentarios_atividade.criado_em) AS ultimo_comentario
           FROM public.comentarios_atividade
          GROUP BY comentarios_atividade.atividade_id) c ON ((c.atividade_id = a.id)));


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    acao text NOT NULL,
    tabela text,
    registro_id uuid,
    detalhes jsonb,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: certificados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_matricula text NOT NULL,
    aluno_nome text,
    turma text,
    tipo text DEFAULT 'conquista'::text,
    titulo text NOT NULL,
    descricao text,
    emissor_id uuid,
    emissor_nome text,
    emissor_cargo text,
    assinatura_url text,
    codigo_verificacao text,
    emitido_em timestamp with time zone DEFAULT now(),
    visualizado boolean DEFAULT false,
    CONSTRAINT certificados_tipo_check CHECK ((tipo = ANY (ARRAY['conquista'::text, 'destaque'::text, 'participacao'::text, 'menção'::text, 'personalizado'::text])))
);


--
-- Name: codigos_vinculo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.codigos_vinculo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo text NOT NULL,
    aluno_matricula text NOT NULL,
    aluno_nome text,
    usado boolean DEFAULT false,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now(),
    expira_em timestamp with time zone
);


--
-- Name: conquistas_aluno; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conquistas_aluno (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_matricula text NOT NULL,
    aluno_nome text,
    turma text,
    badge text NOT NULL,
    icone text,
    descricao text,
    pontos integer DEFAULT 10,
    conquistado_em timestamp with time zone DEFAULT now()
);


--
-- Name: envios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.envios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    atividade_id uuid,
    professor_id uuid,
    professor_nome text,
    aluno_matricula text NOT NULL,
    aluno_nome text NOT NULL,
    turma text NOT NULL,
    titulo text NOT NULL,
    descricao text,
    arquivo_url text,
    arquivo_tipo text,
    arquivo_nome text,
    arquivo_tamanho integer,
    status text DEFAULT 'enviado'::text,
    nota numeric(4,1),
    comentario_professor text,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT envios_status_check CHECK ((status = ANY (ARRAY['enviado'::text, 'visualizado'::text, 'corrigido'::text])))
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text,
    local text,
    data_inicio timestamp with time zone NOT NULL,
    data_fim timestamp with time zone,
    imagem_url text,
    autor_id uuid,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: grupos_estudo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grupos_estudo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text,
    atividade_id uuid,
    criador_matricula text NOT NULL,
    criador_nome text,
    turma text,
    materia text,
    data_encontro timestamp with time zone,
    local text,
    link_video text,
    max_participantes integer DEFAULT 10,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: meals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    data date NOT NULL,
    periodo text NOT NULL,
    descricao text NOT NULL,
    foto_url text,
    alergenicos text[] DEFAULT '{}'::text[],
    autor_id uuid,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT meals_periodo_check CHECK ((periodo = ANY (ARRAY['manha'::text, 'almoco'::text, 'tarde'::text, 'noite'::text])))
);


--
-- Name: mensagens_grupo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensagens_grupo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grupo_id uuid,
    autor_matricula text,
    autor_nome text,
    texto text NOT NULL,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: monitores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monitores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_matricula text NOT NULL,
    aluno_nome text,
    turma text,
    materia text NOT NULL,
    descricao text,
    disponibilidade text,
    contato_preferido text,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: mural_honra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mural_honra (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_matricula text NOT NULL,
    aluno_nome text,
    turma text,
    pontos integer DEFAULT 0,
    posicao integer,
    mes integer,
    ano integer,
    destaque boolean DEFAULT false,
    premio text,
    foto_url text,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: participantes_grupo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participantes_grupo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grupo_id uuid,
    aluno_matricula text NOT NULL,
    aluno_nome text,
    entrou_em timestamp with time zone DEFAULT now()
);


--
-- Name: pedidos_ajuda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos_ajuda (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    monitor_id uuid,
    solicitante_matricula text NOT NULL,
    solicitante_nome text,
    materia text,
    mensagem text,
    status text DEFAULT 'pendente'::text,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT pedidos_ajuda_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aceito'::text, 'recusado'::text, 'concluido'::text])))
);


--
-- Name: pedidos_cadastro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos_cadastro (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    senha_hash text NOT NULL,
    tipo text NOT NULL,
    cargo text,
    foto_url text,
    status text DEFAULT 'pendente'::text,
    motivo_rejeicao text,
    analisado_em timestamp with time zone,
    analisado_por uuid,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT pedidos_cadastro_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'rejeitado'::text]))),
    CONSTRAINT pedidos_cadastro_tipo_check CHECK ((tipo = ANY (ARRAY['professor'::text, 'funcionario'::text])))
);


--
-- Name: pontos_aluno; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pontos_aluno (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_matricula text NOT NULL,
    aluno_nome text,
    turma text,
    pontos integer DEFAULT 0,
    nivel integer DEFAULT 1,
    streak integer DEFAULT 0,
    ultima_atividade timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now()
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    texto text NOT NULL,
    imagem_url text,
    categoria text DEFAULT 'noticia'::text,
    fixada boolean DEFAULT false,
    publicado boolean DEFAULT true,
    autor_id uuid,
    criado_em timestamp with time zone DEFAULT now(),
    expira_em timestamp with time zone,
    CONSTRAINT posts_categoria_check CHECK ((categoria = ANY (ARRAY['noticia'::text, 'evento'::text, 'aviso'::text, 'conquista'::text])))
);


--
-- Name: ranking_turmas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ranking_turmas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    turma text NOT NULL,
    pontos_total integer DEFAULT 0,
    media_alunos numeric(5,2) DEFAULT 0,
    total_alunos integer DEFAULT 0,
    atualizado_em timestamp with time zone DEFAULT now()
);


--
-- Name: reacoes_comentario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reacoes_comentario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comentario_id uuid,
    autor_matricula text NOT NULL,
    emoji text NOT NULL,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT reacoes_comentario_emoji_check CHECK ((emoji = ANY (ARRAY['👍'::text, '❤️'::text, '😂'::text, '🤔'::text, '👏'::text, '🔥'::text])))
);


--
-- Name: responsaveis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.responsaveis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    senha_hash text NOT NULL,
    telefone text,
    parentesco text,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now(),
    aprovado boolean DEFAULT false,
    aprovado_em timestamp with time zone,
    aprovado_por uuid,
    motivo_rejeicao text
);


--
-- Name: risco_evasao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risco_evasao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_matricula text NOT NULL,
    aluno_nome text,
    turma text,
    score integer DEFAULT 0,
    nivel_risco text DEFAULT 'baixo'::text,
    fatores jsonb DEFAULT '{}'::jsonb,
    sugestoes jsonb DEFAULT '[]'::jsonb,
    ultima_analise timestamp with time zone DEFAULT now(),
    analisado_por uuid,
    criado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT risco_evasao_nivel_risco_check CHECK ((nivel_risco = ANY (ARRAY['baixo'::text, 'medio'::text, 'alto'::text, 'critico'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    nome text NOT NULL,
    senha_hash text NOT NULL,
    tipo text NOT NULL,
    cargo text,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now(),
    foto_url text,
    aprovado boolean DEFAULT false,
    aprovado_em timestamp with time zone,
    aprovado_por uuid,
    CONSTRAINT users_tipo_check CHECK ((tipo = ANY (ARRAY['funcionario'::text, 'admin'::text, 'professor'::text, 'pendente'::text])))
);


--
-- Name: vinculos_responsavel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vinculos_responsavel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    responsavel_id uuid,
    aluno_matricula text NOT NULL,
    aluno_nome text,
    codigo_vinculo text,
    status text DEFAULT 'ativo'::text,
    criado_em timestamp with time zone DEFAULT now(),
    solicitado_em timestamp with time zone DEFAULT now(),
    CONSTRAINT vinculos_responsavel_status_check CHECK ((status = ANY (ARRAY['ativo'::text, 'pendente'::text, 'cancelado'::text])))
);


--
-- Data for Name: acoes_risco; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.acoes_risco (id, aluno_matricula, tipo, descricao, autor_id, autor_nome, status, criado_em) FROM stdin;
\.


--
-- Data for Name: alertas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alertas (id, aluno_matricula, aluno_nome, turma, tipo, titulo, descricao, severidade, lido, destinatario_tipo, destinatario_id, criado_em) FROM stdin;
\.


--
-- Data for Name: alunos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alunos (id, matricula, nome, turma, serie, turno, foto_url, perfil, boletim, atualizado_em, criado_em) FROM stdin;
\.


--
-- Data for Name: analises_plagio; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.analises_plagio (id, envio_id_1, envio_id_2, aluno_1, aluno_2, turma, atividade_id, similaridade, texto_1, texto_2, analisado_em) FROM stdin;
\.


--
-- Data for Name: announcements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.announcements (id, texto, urgente, ativo, autor_id, criado_em, expira_em) FROM stdin;
\.


--
-- Data for Name: atividades; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.atividades (id, professor_id, professor_nome, titulo, descricao, turma, arquivo_url, arquivo_tipo, prazo, ativo, criado_em) FROM stdin;
\.


--
-- Data for Name: atividades_turma; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.atividades_turma (id, professor_id, professor_nome, turma, titulo, descricao, arquivo_url, arquivo_tipo, arquivo_nome, prazo, ativo, criado_em, atualizado_em) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, user_id, acao, tabela, registro_id, detalhes, criado_em) FROM stdin;
\.


--
-- Data for Name: certificados; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.certificados (id, aluno_matricula, aluno_nome, turma, tipo, titulo, descricao, emissor_id, emissor_nome, emissor_cargo, assinatura_url, codigo_verificacao, emitido_em, visualizado) FROM stdin;
\.


--
-- Data for Name: codigos_vinculo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.codigos_vinculo (id, codigo, aluno_matricula, aluno_nome, usado, criado_por, criado_em, expira_em) FROM stdin;
\.


--
-- Data for Name: comentarios_atividade; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.comentarios_atividade (id, atividade_id, autor_tipo, autor_nome, autor_matricula, autor_id, texto, criado_em) FROM stdin;
\.


--
-- Data for Name: conquistas_aluno; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conquistas_aluno (id, aluno_matricula, aluno_nome, turma, badge, icone, descricao, pontos, conquistado_em) FROM stdin;
\.


--
-- Data for Name: envios; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.envios (id, atividade_id, professor_id, professor_nome, aluno_matricula, aluno_nome, turma, titulo, descricao, arquivo_url, arquivo_tipo, arquivo_nome, arquivo_tamanho, status, nota, comentario_professor, criado_em, atualizado_em) FROM stdin;
b410a97f-f8b0-4112-b0cc-62898360c67a	\N	1e3baf7c-8676-4e1d-9410-883ee71c399d	pedro teste	202430395866	PEDRO VICTOR SILVA DOS SANTOS	3º Ano T.I	teste	teste	https://uzuyiinxoomqjrjofevm.supabase.co/storage/v1/object/public/atividades/1790009628579-shqze5.png	image/png	pngwing.com.png	101574	enviado	\N	\N	2026-09-21 16:53:56.110484+00	2026-09-21 16:53:56.110484+00
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.events (id, titulo, descricao, local, data_inicio, data_fim, imagem_url, autor_id, criado_em) FROM stdin;
654a13fa-7188-4a10-8ebd-a3b6d341d97d	snoopy	snoopy v1	escola	2026-09-22 12:37:00+00	2026-09-25 12:37:00+00	https://uzuyiinxoomqjrjofevm.supabase.co/storage/v1/object/public/imagens/1790080609170-6m8960.png	8718f7b7-2100-40c0-a840-555597fc897a	2026-09-22 12:37:27.360223+00
\.


--
-- Data for Name: grupos_estudo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.grupos_estudo (id, titulo, descricao, atividade_id, criador_matricula, criador_nome, turma, materia, data_encontro, local, link_video, max_participantes, ativo, criado_em) FROM stdin;
\.


--
-- Data for Name: meals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.meals (id, data, periodo, descricao, foto_url, alergenicos, autor_id, criado_em) FROM stdin;
\.


--
-- Data for Name: mensagens_grupo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mensagens_grupo (id, grupo_id, autor_matricula, autor_nome, texto, criado_em) FROM stdin;
\.


--
-- Data for Name: monitores; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.monitores (id, aluno_matricula, aluno_nome, turma, materia, descricao, disponibilidade, contato_preferido, ativo, criado_em) FROM stdin;
\.


--
-- Data for Name: mural_honra; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mural_honra (id, aluno_matricula, aluno_nome, turma, pontos, posicao, mes, ano, destaque, premio, foto_url, criado_em) FROM stdin;
\.


--
-- Data for Name: participantes_grupo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.participantes_grupo (id, grupo_id, aluno_matricula, aluno_nome, entrou_em) FROM stdin;
\.


--
-- Data for Name: pedidos_ajuda; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pedidos_ajuda (id, monitor_id, solicitante_matricula, solicitante_nome, materia, mensagem, status, criado_em) FROM stdin;
\.


--
-- Data for Name: pedidos_cadastro; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pedidos_cadastro (id, nome, email, senha_hash, tipo, cargo, foto_url, status, motivo_rejeicao, analisado_em, analisado_por, criado_em) FROM stdin;
40c13cf0-3adb-4819-9849-22441051d885	pedro teste	pedrovictor1503@gmail.com	$2a$10$KzelGLMyy7xjzLP2OtfPE.Dmks9LAzzRjncnvDFqQfY5aKqmDYWmq	professor	\N	\N	aprovado	\N	2026-09-21 16:43:17.361+00	\N	2026-09-21 16:31:38.145416+00
98d4c5d9-2ee3-44db-a842-145cf91e45a0	Teste	teste@teste.com	$2a$10$TsEG8n9IbSj5PS5VrdiJJ.5yiQ035qDZWBN.wFO/hNwYePJZhjdke	professor	\N	\N	aprovado	\N	2026-09-21 18:14:12.163+00	\N	2026-09-21 18:05:33.378846+00
\.


--
-- Data for Name: pontos_aluno; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pontos_aluno (id, aluno_matricula, aluno_nome, turma, pontos, nivel, streak, ultima_atividade, criado_em, atualizado_em) FROM stdin;
\.


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.posts (id, titulo, texto, imagem_url, categoria, fixada, publicado, autor_id, criado_em, expira_em) FROM stdin;
f3ec42e8-97a0-479b-be8b-c17b16a4f41d	snoopy	snoopy	https://uzuyiinxoomqjrjofevm.supabase.co/storage/v1/object/public/imagens/1790081313545-nzdqng.png	noticia	f	t	8718f7b7-2100-40c0-a840-555597fc897a	2026-09-22 12:48:57.461935+00	\N
\.


--
-- Data for Name: ranking_turmas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ranking_turmas (id, turma, pontos_total, media_alunos, total_alunos, atualizado_em) FROM stdin;
\.


--
-- Data for Name: reacoes_comentario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reacoes_comentario (id, comentario_id, autor_matricula, emoji, criado_em) FROM stdin;
\.


--
-- Data for Name: responsaveis; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.responsaveis (id, nome, email, senha_hash, telefone, parentesco, ativo, criado_em, aprovado, aprovado_em, aprovado_por, motivo_rejeicao) FROM stdin;
\.


--
-- Data for Name: risco_evasao; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.risco_evasao (id, aluno_matricula, aluno_nome, turma, score, nivel_risco, fatores, sugestoes, ultima_analise, analisado_por, criado_em) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, nome, senha_hash, tipo, cargo, ativo, criado_em, foto_url, aprovado, aprovado_em, aprovado_por) FROM stdin;
46b770ce-0ddc-47f3-95ca-59f33102fd57	shaolinmatadordeporco1918@gmail.com	Professor 1	$2a$10$FnOWCG6tIioDa.rMxw5gN.UyshwBT.OqdfKBO7PyzYqyvwmGIF7l.	funcionario	professor 	t	2026-09-21 00:38:53.188755+00	\N	f	\N	\N
8718f7b7-2100-40c0-a840-555597fc897a	admin@eeim.rn.gov.br	Administrador	$2a$10$n1GizihcSzQI8F6QHGemXee/ZTsiMIvev6KnEB0NT9Ls6Jmu2BMk2	admin	Diretor(a)	t	2026-09-20 23:39:02.866888+00	\N	t	\N	\N
1e3baf7c-8676-4e1d-9410-883ee71c399d	pedrovictor1503@gmail.com	pedro teste	$2a$10$KzelGLMyy7xjzLP2OtfPE.Dmks9LAzzRjncnvDFqQfY5aKqmDYWmq	professor	\N	t	2026-09-21 16:43:17.854281+00	\N	t	2026-09-21 16:43:16.85+00	\N
8bd66173-0f37-437f-9a13-b345d0d3ca03	teste@teste.com	Teste	$2a$10$TsEG8n9IbSj5PS5VrdiJJ.5yiQ035qDZWBN.wFO/hNwYePJZhjdke	professor	\N	t	2026-09-21 18:14:12.084502+00	\N	t	2026-09-21 18:14:11.792+00	\N
\.


--
-- Data for Name: vinculos_responsavel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vinculos_responsavel (id, responsavel_id, aluno_matricula, aluno_nome, codigo_vinculo, status, criado_em, solicitado_em) FROM stdin;
\.


--
-- Name: acoes_risco acoes_risco_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acoes_risco
    ADD CONSTRAINT acoes_risco_pkey PRIMARY KEY (id);


--
-- Name: alertas alertas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_pkey PRIMARY KEY (id);


--
-- Name: alunos alunos_matricula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_matricula_key UNIQUE (matricula);


--
-- Name: alunos alunos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_pkey PRIMARY KEY (id);


--
-- Name: analises_plagio analises_plagio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analises_plagio
    ADD CONSTRAINT analises_plagio_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: atividades atividades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades
    ADD CONSTRAINT atividades_pkey PRIMARY KEY (id);


--
-- Name: atividades_turma atividades_turma_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades_turma
    ADD CONSTRAINT atividades_turma_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: certificados certificados_codigo_verificacao_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificados
    ADD CONSTRAINT certificados_codigo_verificacao_key UNIQUE (codigo_verificacao);


--
-- Name: certificados certificados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificados
    ADD CONSTRAINT certificados_pkey PRIMARY KEY (id);


--
-- Name: codigos_vinculo codigos_vinculo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_vinculo
    ADD CONSTRAINT codigos_vinculo_codigo_key UNIQUE (codigo);


--
-- Name: codigos_vinculo codigos_vinculo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_vinculo
    ADD CONSTRAINT codigos_vinculo_pkey PRIMARY KEY (id);


--
-- Name: comentarios_atividade comentarios_atividade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios_atividade
    ADD CONSTRAINT comentarios_atividade_pkey PRIMARY KEY (id);


--
-- Name: conquistas_aluno conquistas_aluno_aluno_matricula_badge_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conquistas_aluno
    ADD CONSTRAINT conquistas_aluno_aluno_matricula_badge_key UNIQUE (aluno_matricula, badge);


--
-- Name: conquistas_aluno conquistas_aluno_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conquistas_aluno
    ADD CONSTRAINT conquistas_aluno_pkey PRIMARY KEY (id);


--
-- Name: envios envios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.envios
    ADD CONSTRAINT envios_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: grupos_estudo grupos_estudo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupos_estudo
    ADD CONSTRAINT grupos_estudo_pkey PRIMARY KEY (id);


--
-- Name: meals meals_data_periodo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_data_periodo_key UNIQUE (data, periodo);


--
-- Name: meals meals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_pkey PRIMARY KEY (id);


--
-- Name: mensagens_grupo mensagens_grupo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_grupo
    ADD CONSTRAINT mensagens_grupo_pkey PRIMARY KEY (id);


--
-- Name: monitores monitores_aluno_matricula_materia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitores
    ADD CONSTRAINT monitores_aluno_matricula_materia_key UNIQUE (aluno_matricula, materia);


--
-- Name: monitores monitores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitores
    ADD CONSTRAINT monitores_pkey PRIMARY KEY (id);


--
-- Name: mural_honra mural_honra_aluno_matricula_mes_ano_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mural_honra
    ADD CONSTRAINT mural_honra_aluno_matricula_mes_ano_key UNIQUE (aluno_matricula, mes, ano);


--
-- Name: mural_honra mural_honra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mural_honra
    ADD CONSTRAINT mural_honra_pkey PRIMARY KEY (id);


--
-- Name: participantes_grupo participantes_grupo_grupo_id_aluno_matricula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participantes_grupo
    ADD CONSTRAINT participantes_grupo_grupo_id_aluno_matricula_key UNIQUE (grupo_id, aluno_matricula);


--
-- Name: participantes_grupo participantes_grupo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participantes_grupo
    ADD CONSTRAINT participantes_grupo_pkey PRIMARY KEY (id);


--
-- Name: pedidos_ajuda pedidos_ajuda_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_ajuda
    ADD CONSTRAINT pedidos_ajuda_pkey PRIMARY KEY (id);


--
-- Name: pedidos_cadastro pedidos_cadastro_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_cadastro
    ADD CONSTRAINT pedidos_cadastro_email_key UNIQUE (email);


--
-- Name: pedidos_cadastro pedidos_cadastro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_cadastro
    ADD CONSTRAINT pedidos_cadastro_pkey PRIMARY KEY (id);


--
-- Name: pontos_aluno pontos_aluno_aluno_matricula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pontos_aluno
    ADD CONSTRAINT pontos_aluno_aluno_matricula_key UNIQUE (aluno_matricula);


--
-- Name: pontos_aluno pontos_aluno_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pontos_aluno
    ADD CONSTRAINT pontos_aluno_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: ranking_turmas ranking_turmas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_turmas
    ADD CONSTRAINT ranking_turmas_pkey PRIMARY KEY (id);


--
-- Name: ranking_turmas ranking_turmas_turma_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_turmas
    ADD CONSTRAINT ranking_turmas_turma_key UNIQUE (turma);


--
-- Name: reacoes_comentario reacoes_comentario_comentario_id_autor_matricula_emoji_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reacoes_comentario
    ADD CONSTRAINT reacoes_comentario_comentario_id_autor_matricula_emoji_key UNIQUE (comentario_id, autor_matricula, emoji);


--
-- Name: reacoes_comentario reacoes_comentario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reacoes_comentario
    ADD CONSTRAINT reacoes_comentario_pkey PRIMARY KEY (id);


--
-- Name: responsaveis responsaveis_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsaveis
    ADD CONSTRAINT responsaveis_email_key UNIQUE (email);


--
-- Name: responsaveis responsaveis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsaveis
    ADD CONSTRAINT responsaveis_pkey PRIMARY KEY (id);


--
-- Name: risco_evasao risco_evasao_aluno_matricula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risco_evasao
    ADD CONSTRAINT risco_evasao_aluno_matricula_key UNIQUE (aluno_matricula);


--
-- Name: risco_evasao risco_evasao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risco_evasao
    ADD CONSTRAINT risco_evasao_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vinculos_responsavel vinculos_responsavel_codigo_vinculo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vinculos_responsavel
    ADD CONSTRAINT vinculos_responsavel_codigo_vinculo_key UNIQUE (codigo_vinculo);


--
-- Name: vinculos_responsavel vinculos_responsavel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vinculos_responsavel
    ADD CONSTRAINT vinculos_responsavel_pkey PRIMARY KEY (id);


--
-- Name: vinculos_responsavel vinculos_responsavel_responsavel_id_aluno_matricula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vinculos_responsavel
    ADD CONSTRAINT vinculos_responsavel_responsavel_id_aluno_matricula_key UNIQUE (responsavel_id, aluno_matricula);


--
-- Name: idx_acoes_aluno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acoes_aluno ON public.acoes_risco USING btree (aluno_matricula);


--
-- Name: idx_alertas_aluno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alertas_aluno ON public.alertas USING btree (aluno_matricula);


--
-- Name: idx_alertas_destinatario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alertas_destinatario ON public.alertas USING btree (destinatario_tipo, destinatario_id);


--
-- Name: idx_alertas_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alertas_turma ON public.alertas USING btree (turma);


--
-- Name: idx_atividades_prazo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atividades_prazo ON public.atividades USING btree (prazo DESC);


--
-- Name: idx_atividades_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atividades_turma ON public.atividades USING btree (turma);


--
-- Name: idx_atvturma_criado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atvturma_criado ON public.atividades_turma USING btree (criado_em DESC);


--
-- Name: idx_atvturma_professor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atvturma_professor ON public.atividades_turma USING btree (professor_id);


--
-- Name: idx_atvturma_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atvturma_turma ON public.atividades_turma USING btree (turma);


--
-- Name: idx_audit_criado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_criado ON public.audit_logs USING btree (criado_em DESC);


--
-- Name: idx_cert_aluno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cert_aluno ON public.certificados USING btree (aluno_matricula);


--
-- Name: idx_cert_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cert_codigo ON public.certificados USING btree (codigo_verificacao);


--
-- Name: idx_cert_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cert_turma ON public.certificados USING btree (turma);


--
-- Name: idx_codigos_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_codigos_codigo ON public.codigos_vinculo USING btree (codigo);


--
-- Name: idx_coment_atividade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coment_atividade ON public.comentarios_atividade USING btree (atividade_id);


--
-- Name: idx_coment_criado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coment_criado ON public.comentarios_atividade USING btree (criado_em);


--
-- Name: idx_conquistas_aluno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conquistas_aluno ON public.conquistas_aluno USING btree (aluno_matricula);


--
-- Name: idx_envios_aluno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_envios_aluno ON public.envios USING btree (aluno_matricula);


--
-- Name: idx_envios_atividade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_envios_atividade ON public.envios USING btree (atividade_id);


--
-- Name: idx_envios_professor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_envios_professor ON public.envios USING btree (professor_id);


--
-- Name: idx_envios_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_envios_turma ON public.envios USING btree (turma);


--
-- Name: idx_events_inicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_inicio ON public.events USING btree (data_inicio DESC);


--
-- Name: idx_grupos_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grupos_ativo ON public.grupos_estudo USING btree (ativo);


--
-- Name: idx_grupos_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grupos_turma ON public.grupos_estudo USING btree (turma);


--
-- Name: idx_meals_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meals_data ON public.meals USING btree (data DESC);


--
-- Name: idx_mensagens_grupo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mensagens_grupo ON public.mensagens_grupo USING btree (grupo_id);


--
-- Name: idx_monitores_materia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_monitores_materia ON public.monitores USING btree (materia);


--
-- Name: idx_monitores_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_monitores_turma ON public.monitores USING btree (turma);


--
-- Name: idx_mural_mes_ano; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mural_mes_ano ON public.mural_honra USING btree (ano DESC, mes DESC);


--
-- Name: idx_mural_posicao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mural_posicao ON public.mural_honra USING btree (posicao);


--
-- Name: idx_participantes_grupo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_participantes_grupo ON public.participantes_grupo USING btree (grupo_id);


--
-- Name: idx_pedidos_monitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_monitor ON public.pedidos_ajuda USING btree (monitor_id);


--
-- Name: idx_pedidos_solicitante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_solicitante ON public.pedidos_ajuda USING btree (solicitante_matricula);


--
-- Name: idx_pedidos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_status ON public.pedidos_cadastro USING btree (status);


--
-- Name: idx_plagio_atividade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plagio_atividade ON public.analises_plagio USING btree (atividade_id);


--
-- Name: idx_plagio_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plagio_turma ON public.analises_plagio USING btree (turma);


--
-- Name: idx_pontos_total; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pontos_total ON public.pontos_aluno USING btree (pontos DESC);


--
-- Name: idx_pontos_turma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pontos_turma ON public.pontos_aluno USING btree (turma);


--
-- Name: idx_posts_criado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_criado ON public.posts USING btree (criado_em DESC);


--
-- Name: idx_posts_publicado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_publicado ON public.posts USING btree (publicado);


--
-- Name: idx_reacoes_comentario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reacoes_comentario ON public.reacoes_comentario USING btree (comentario_id);


--
-- Name: idx_responsaveis_aprovado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_responsaveis_aprovado ON public.responsaveis USING btree (aprovado);


--
-- Name: idx_risco_nivel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_risco_nivel ON public.risco_evasao USING btree (nivel_risco);


--
-- Name: idx_risco_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_risco_score ON public.risco_evasao USING btree (score DESC);


--
-- Name: idx_users_aprovado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_aprovado ON public.users USING btree (aprovado);


--
-- Name: idx_users_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_tipo ON public.users USING btree (tipo);


--
-- Name: idx_vinculos_aluno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vinculos_aluno ON public.vinculos_responsavel USING btree (aluno_matricula);


--
-- Name: idx_vinculos_resp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vinculos_resp ON public.vinculos_responsavel USING btree (responsavel_id);


--
-- Name: atividades_turma trg_atvturma_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_atvturma_update BEFORE UPDATE ON public.atividades_turma FOR EACH ROW EXECUTE FUNCTION public.atualizar_timestamp();


--
-- Name: pontos_aluno trg_pontos_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pontos_update BEFORE UPDATE ON public.pontos_aluno FOR EACH ROW EXECUTE FUNCTION public.atualizar_timestamp_mod();


--
-- Name: acoes_risco acoes_risco_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acoes_risco
    ADD CONSTRAINT acoes_risco_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: announcements announcements_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: atividades atividades_professor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades
    ADD CONSTRAINT atividades_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: atividades_turma atividades_turma_professor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades_turma
    ADD CONSTRAINT atividades_turma_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: certificados certificados_emissor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificados
    ADD CONSTRAINT certificados_emissor_id_fkey FOREIGN KEY (emissor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: codigos_vinculo codigos_vinculo_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_vinculo
    ADD CONSTRAINT codigos_vinculo_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: comentarios_atividade comentarios_atividade_atividade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios_atividade
    ADD CONSTRAINT comentarios_atividade_atividade_id_fkey FOREIGN KEY (atividade_id) REFERENCES public.atividades_turma(id) ON DELETE CASCADE;


--
-- Name: comentarios_atividade comentarios_atividade_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios_atividade
    ADD CONSTRAINT comentarios_atividade_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: envios envios_atividade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.envios
    ADD CONSTRAINT envios_atividade_id_fkey FOREIGN KEY (atividade_id) REFERENCES public.atividades(id) ON DELETE CASCADE;


--
-- Name: envios envios_professor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.envios
    ADD CONSTRAINT envios_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: events events_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: meals meals_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: mensagens_grupo mensagens_grupo_grupo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_grupo
    ADD CONSTRAINT mensagens_grupo_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos_estudo(id) ON DELETE CASCADE;


--
-- Name: participantes_grupo participantes_grupo_grupo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participantes_grupo
    ADD CONSTRAINT participantes_grupo_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos_estudo(id) ON DELETE CASCADE;


--
-- Name: pedidos_ajuda pedidos_ajuda_monitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_ajuda
    ADD CONSTRAINT pedidos_ajuda_monitor_id_fkey FOREIGN KEY (monitor_id) REFERENCES public.monitores(id) ON DELETE CASCADE;


--
-- Name: pedidos_cadastro pedidos_cadastro_analisado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos_cadastro
    ADD CONSTRAINT pedidos_cadastro_analisado_por_fkey FOREIGN KEY (analisado_por) REFERENCES public.users(id);


--
-- Name: posts posts_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reacoes_comentario reacoes_comentario_comentario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reacoes_comentario
    ADD CONSTRAINT reacoes_comentario_comentario_id_fkey FOREIGN KEY (comentario_id) REFERENCES public.comentarios_atividade(id) ON DELETE CASCADE;


--
-- Name: responsaveis responsaveis_aprovado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsaveis
    ADD CONSTRAINT responsaveis_aprovado_por_fkey FOREIGN KEY (aprovado_por) REFERENCES public.users(id);


--
-- Name: risco_evasao risco_evasao_analisado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risco_evasao
    ADD CONSTRAINT risco_evasao_analisado_por_fkey FOREIGN KEY (analisado_por) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users users_aprovado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_aprovado_por_fkey FOREIGN KEY (aprovado_por) REFERENCES public.users(id);


--
-- Name: vinculos_responsavel vinculos_responsavel_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vinculos_responsavel
    ADD CONSTRAINT vinculos_responsavel_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.responsaveis(id) ON DELETE CASCADE;


--
-- Name: acoes_risco; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acoes_risco ENABLE ROW LEVEL SECURITY;

--
-- Name: alertas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

--
-- Name: alertas alertas_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alertas_leitura ON public.alertas FOR SELECT USING (true);


--
-- Name: alunos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

--
-- Name: analises_plagio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analises_plagio ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements announcements_ativos_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY announcements_ativos_leitura ON public.announcements FOR SELECT USING ((ativo = true));


--
-- Name: atividades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;

--
-- Name: atividades_turma; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atividades_turma ENABLE ROW LEVEL SECURITY;

--
-- Name: atividades_turma atvturma_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atvturma_leitura ON public.atividades_turma FOR SELECT USING ((ativo = true));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: certificados; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;

--
-- Name: codigos_vinculo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.codigos_vinculo ENABLE ROW LEVEL SECURITY;

--
-- Name: comentarios_atividade; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comentarios_atividade ENABLE ROW LEVEL SECURITY;

--
-- Name: comentarios_atividade comentarios_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comentarios_leitura ON public.comentarios_atividade FOR SELECT USING (true);


--
-- Name: conquistas_aluno; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conquistas_aluno ENABLE ROW LEVEL SECURITY;

--
-- Name: conquistas_aluno conquistas_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conquistas_leitura ON public.conquistas_aluno FOR SELECT USING (true);


--
-- Name: envios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.envios ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: events events_leitura_publica; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_leitura_publica ON public.events FOR SELECT USING (true);


--
-- Name: grupos_estudo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grupos_estudo ENABLE ROW LEVEL SECURITY;

--
-- Name: grupos_estudo grupos_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grupos_leitura ON public.grupos_estudo FOR SELECT USING ((ativo = true));


--
-- Name: meals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

--
-- Name: meals meals_leitura_publica; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meals_leitura_publica ON public.meals FOR SELECT USING (true);


--
-- Name: mensagens_grupo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mensagens_grupo ENABLE ROW LEVEL SECURITY;

--
-- Name: mensagens_grupo mensagens_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensagens_leitura ON public.mensagens_grupo FOR SELECT USING (true);


--
-- Name: monitores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.monitores ENABLE ROW LEVEL SECURITY;

--
-- Name: monitores monitores_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY monitores_leitura ON public.monitores FOR SELECT USING ((ativo = true));


--
-- Name: mural_honra; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mural_honra ENABLE ROW LEVEL SECURITY;

--
-- Name: mural_honra mural_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mural_leitura ON public.mural_honra FOR SELECT USING (true);


--
-- Name: participantes_grupo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.participantes_grupo ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos_ajuda; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedidos_ajuda ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos_cadastro; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedidos_cadastro ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos_ajuda pedidos_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_leitura ON public.pedidos_ajuda FOR SELECT USING (true);


--
-- Name: pontos_aluno; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pontos_aluno ENABLE ROW LEVEL SECURITY;

--
-- Name: pontos_aluno pontos_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pontos_leitura ON public.pontos_aluno FOR SELECT USING (true);


--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: posts posts_publicos_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY posts_publicos_leitura ON public.posts FOR SELECT USING ((publicado = true));


--
-- Name: ranking_turmas ranking_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ranking_leitura ON public.ranking_turmas FOR SELECT USING (true);


--
-- Name: ranking_turmas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ranking_turmas ENABLE ROW LEVEL SECURITY;

--
-- Name: reacoes_comentario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reacoes_comentario ENABLE ROW LEVEL SECURITY;

--
-- Name: reacoes_comentario reacoes_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reacoes_leitura ON public.reacoes_comentario FOR SELECT USING (true);


--
-- Name: responsaveis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;

--
-- Name: risco_evasao; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.risco_evasao ENABLE ROW LEVEL SECURITY;

--
-- Name: risco_evasao risco_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY risco_leitura ON public.risco_evasao FOR SELECT USING (true);


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: vinculos_responsavel vinculos_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vinculos_leitura ON public.vinculos_responsavel FOR SELECT USING ((status = 'ativo'::text));


--
-- Name: vinculos_responsavel; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vinculos_responsavel ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict k3dcKbtb5cHuJeG0cSKHjJwgr1y0tWVtyeDE5Loxu72s0fo9IUm74xvAAqY6XDR

