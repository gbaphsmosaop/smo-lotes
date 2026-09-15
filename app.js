/* =====================================================================
   SMO/SAOP — GBAPH/CBMPE — Controle de material
   NÚCLEO. Tudo que os módulos compartilham mora aqui, no objeto A.
   Cada módulo se registra com A.registrarAba() e recebe seu <section>.
   ===================================================================== */
"use strict";

window.A = {
  sb: null, sessao: null, perfil: null,
  itens: [], lotes: [], locais: [], perfis: [], equipamentos: [], resumo: null,
  abas: [], abaAtual: "painel", periodo: 90,
  filtros: {}                       // um módulo pode abrir outro já filtrado
};

/* ------------------------------------------------------------ utilidades */
A.$ = id => document.getElementById(id);
A.esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
A.nfmt = n => (n === null || n === undefined || isNaN(n)) ? "—" : Number(n).toLocaleString("pt-BR");
A.moeda = n => (n === null || n === undefined || isNaN(n)) ? "—"
  : Number(n).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

A.HOJE = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
A.hojeISO = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0")
       + "-" + String(d.getDate()).padStart(2,"0");
};
A.diasAte = v => {
  if (!v) return null;
  const p = String(v).slice(0,10).split("-");
  const d = new Date(+p[0], +p[1]-1, +p[2]); d.setHours(0,0,0,0);
  return Math.round((d - A.HOJE) / 86400000);
};
A.brData = v => {
  if (!v) return "—";
  const p = String(v).slice(0,10).split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
};
A.faixa = v => {
  const d = A.diasAte(v);
  if (d === null) return "s";
  if (d < 0) return "v";
  if (d <= 30) return "a";
  if (d <= 90) return "b";
  return "o";
};
A.ROTULO = { v:"Vencido", a:"Vence em 30 dias", b:"Vence em 90 dias", o:"Válido", s:"Sem validade" };
A.pode = () => !!A.perfil && ["chefe","operador"].includes(A.perfil.papel);
A.eChefe = () => !!A.perfil && A.perfil.papel === "chefe";

A.toast = (msg, ruim) => {
  const t = document.createElement("div");
  t.className = "toast" + (ruim ? " bad" : "");
  t.textContent = msg;
  A.$("toasts").appendChild(t);
  setTimeout(() => t.remove(), ruim ? 6500 : 3400);
};

/** Traduz o erro cru do Postgres ou da rede para algo que o militar entenda. */
A.explicar = e => {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/Invalid login credentials/i.test(m))    return "E-mail ou senha não conferem.";
  if (/User already registered/i.test(m))      return "Esse e-mail já tem conta. Use a aba Entrar.";
  if (/Password should be/i.test(m))           return "A senha precisa de pelo menos 8 caracteres.";
  if (/Email not confirmed/i.test(m))          return "Confirme o e-mail antes de entrar.";
  if (/signups are disabled/i.test(m))         return "O cadastro está fechado. Peça ao chefe da seção para criar seu acesso.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sem conexão com o servidor. Tente de novo quando a rede voltar.";
  if (/duplicate key|unique/i.test(m))         return "Já existe um registro com esses dados.";
  return m.replace(/^.*?:\s*/, "");
};

/* ------------------------------------------------------------ formulários */
A.opcoes = (arr, sel, chave, rot) => arr.map(o => {
  const v = chave ? o[chave] : o;
  const t = rot ? o[rot] : o;
  return '<option value="' + A.esc(v) + '"' + (String(v) === String(sel) ? " selected" : "")
       + ">" + A.esc(t) + "</option>";
}).join("");
A.opcoesItens  = sel => A.opcoes(
  A.itens.slice().sort((a,b) => a.nome.localeCompare(b.nome,"pt-BR")), sel, "id", "nome");
A.opcoesLocais = sel => A.opcoes(A.locais, sel, "id", "nome");

/* ---------------------------------------------------------------- modais */
A.modal = (titulo, corpo, rodape, larga) => {
  A.$("modais").innerHTML =
    '<div class="scrim"><div class="modal' + (larga ? " larga" : "")
    + '" role="dialog" aria-modal="true" aria-label="' + A.esc(titulo)
    + '"><div class="mhead"><h3>' + A.esc(titulo)
    + '</h3><button class="x" aria-label="Fechar">&times;</button></div>'
    + '<div class="mbody">' + corpo + "</div>"
    + (rodape ? '<div class="mfoot">' + rodape + "</div>" : "") + "</div></div>";
  A.$("modais").querySelector(".x").onclick = A.fecharModal;
  A.$("modais").querySelector(".scrim").addEventListener("click", e => {
    if (e.target.classList.contains("scrim")) A.fecharModal();
  });
  document.addEventListener("keydown", A._esc);
  const p = A.$("modais").querySelector("input,select,textarea,button:not(.x)");
  if (p) p.focus();
};
A.fecharModal = () => { A.$("modais").innerHTML = ""; document.removeEventListener("keydown", A._esc); };
A._esc = e => { if (e.key === "Escape") A.fecharModal(); };
A.erroModal = (idCaixa, e) => {
  const c = A.$(idCaixa);
  if (c) c.innerHTML = '<div class="err">' + A.esc(A.explicar(e)) + "</div>";
};

/** Envolve o salvar de um modal: trava o botão, trata erro, fecha e recarrega. */
A.salvar = async (btnId, caixaMsg, fn, sucesso) => {
  const b = A.$(btnId);
  if (b) b.disabled = true;
  try {
    await fn();
    A.fecharModal();
    if (sucesso) A.toast(sucesso);
    await A.recarregar();
  } catch (e) {
    A.erroModal(caixaMsg, e);
    if (b) b.disabled = false;
  }
};

/* -------------------------------------------------------------- navegação */
A.registrarAba = (id, rotulo, render, contador) =>
  A.abas.push({ id, rotulo, render, contador });

A.irPara = (id, filtros) => {
  A.abaAtual = id;
  A.filtros = filtros || {};
  A.abas.forEach(t => {
    const s = A.$("sec-" + t.id);
    if (s) s.hidden = (t.id !== id);
  });
  A.desenharNav();
  const aba = A.abas.find(t => t.id === id);
  if (aba) aba.render(A.$("sec-" + id));
  window.scrollTo({ top:0, behavior:"smooth" });
};

A.desenharNav = () => {
  A.$("nav").innerHTML = A.abas.map(t => {
    let n = null;
    try { n = t.contador ? t.contador() : null; } catch(e){ n = null; }
    return '<button data-aba="' + t.id + '"'
      + (t.id === A.abaAtual ? ' aria-current="page"' : "") + ">" + A.esc(t.rotulo)
      + (n && n.qtd ? '<span class="bolha' + (n.urgente ? "" : " calmo") + '">' + n.qtd + "</span>" : "")
      + "</button>";
  }).join("");
  A.$("nav").querySelectorAll("[data-aba]").forEach(b =>
    b.onclick = () => A.irPara(b.dataset.aba));
};

/** Redesenha só a aba visível — usado depois de gravar algo. */
A.redesenhar = () => {
  if (!A.abas.length) return;
  A.desenharNav();
  const aba = A.abas.find(t => t.id === A.abaAtual);
  if (aba) aba.render(A.$("sec-" + A.abaAtual));
};

/* ------------------------------------------------------------------ dados */
A.urlFoto = path => path
  ? A.sb.storage.from("fotos-itens").getPublicUrl(path).data.publicUrl : null;

let carregando = null;
A.recarregar = async () => {
  if (carregando) return carregando;
  carregando = (async () => {
    try {
      const [p, l, lo, pe, eq, rs] = await Promise.all([
        A.sb.from("v_painel").select("*").order("nome"),
        A.sb.from("lotes").select("*").gt("qtd_atual", 0),
        A.sb.from("locais").select("*").eq("ativo", true).order("ordem"),
        A.sb.from("perfis").select("id,nome_guerra,posto_grad,papel,ativo").eq("ativo", true).order("nome_guerra"),
        A.sb.from("v_equipamentos").select("*").order("categoria").order("nome"),
        A.sb.rpc("painel_resumo", { p_dias: A.periodo })
      ]);
      if (p.error) throw p.error;
      A.itens        = p.data  || [];
      A.lotes        = l.data  || [];
      A.locais       = lo.data || [];
      A.perfis       = pe.data || [];
      A.equipamentos = eq.error ? [] : (eq.data || []);
      A.resumo       = rs.error ? null : (rs.data || null);
      if (eq.error || rs.error) A.avisarModulosFaltando();
      A.redesenhar();
      A.rodape();
    } catch (e) {
      const b = A.$("banner");
      b.hidden = false; b.className = "banner bad";
      b.innerHTML = "<b>Não deu para carregar os dados.</b> " + A.esc(A.explicar(e));
    } finally { carregando = null; }
  })();
  return carregando;
};

A.avisarModulosFaltando = () => {
  const b = A.$("banner");
  b.hidden = false; b.className = "banner info";
  b.innerHTML = "<b>Faltam os módulos novos no banco.</b> Equipamentos, pedidos, missões e o "
    + "painel de decisão só aparecem depois de rodar <b>sql/03-modulos.sql</b> e "
    + "<b>sql/04-equipamentos.sql</b> no SQL Editor do Supabase. O estoque funciona normalmente sem eles.";
};

A.lotesDoItem = id => A.lotes.filter(l => l.item_id === id)
  .sort((a,b) => String(a.validade || "9999").localeCompare(String(b.validade || "9999")));

A.rodape = () => {
  A.$("rodape").textContent =
    A.itens.length + " itens · " + A.lotes.length + " lotes ativos · "
    + A.equipamentos.length + " equipamentos · " + (window.UNIDADE || "GBAPH / CBMPE");
};

A.atualizaRede = () => { A.$("ch-rede").hidden = navigator.onLine; };

/* ------------------------------------------------------------ configuração */
A.telaConfig = (titulo, corpo) => {
  document.body.innerHTML =
    '<div class="login-wrap"><div class="login"><div class="top">'
    + "<div><h1>" + A.esc(titulo) + "</h1></div></div>"
    + '<div class="body" style="font-size:13px">' + corpo + "</div></div></div>";
};
A.limparURL = u => String(u || "").trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
A.conferirURL = u => {
  if (/COLE_AQUI/.test(u) || !u)
    return "Abra o <b>config.js</b> e cole, em <b>SUPABASE_URL</b>, o <b>Project URL</b> "
      + "que fica em <b>Project Settings → Data API</b>. Depois recarregue.";
  if (/supabase\.com\/dashboard/.test(u) || /\/project\//.test(u))
    return "Você colou o endereço do <b>painel</b>, não o da API. Pegue em "
      + "<b>Project Settings → Data API → Project URL</b> — tem a forma "
      + "<code>https://SEU-PROJETO.supabase.co</code>.";
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in|red)$/i.test(u))
    return "A URL <code>" + A.esc(u) + "</code> não tem o formato esperado "
      + "(<code>https://SEU-PROJETO.supabase.co</code>). Copie de novo o <b>Project URL</b>, "
      + "sem barra no fim e sem nada depois de <code>.supabase.co</code>.";
  return "";
};

/* ------------------------------------------------------------------ login */
let modoCriar = false;

A.ligarLogin = () => {
  const troca = criar => {
    modoCriar = criar;
    A.$("ab-entrar").setAttribute("aria-selected", String(!criar));
    A.$("ab-criar").setAttribute("aria-selected", String(criar));
    A.$("cx-nome").hidden = !criar;
    A.$("lg-ok").textContent = criar ? "Criar acesso" : "Entrar";
    A.$("lg-senha").autocomplete = criar ? "new-password" : "current-password";
    A.$("login-msg").innerHTML = "";
  };
  A.$("ab-entrar").onclick = () => troca(false);
  A.$("ab-criar").onclick  = () => troca(true);
  A.$("lg-ok").onclick = A.entrar;
  ["lg-email","lg-senha","lg-nome"].forEach(id =>
    A.$(id).addEventListener("keydown", e => { if (e.key === "Enter") A.entrar(); }));
  A.$("tela-login").hidden = false;
};

A.entrar = async () => {
  const email = A.$("lg-email").value.trim();
  const senha = A.$("lg-senha").value;
  const nome  = A.$("lg-nome").value.trim();
  const msg   = A.$("login-msg");
  msg.innerHTML = "";
  if (!email || !senha){ msg.innerHTML = '<div class="err">Preencha e-mail e senha.</div>'; return; }
  if (modoCriar && !nome){ msg.innerHTML = '<div class="err">Informe seu nome de guerra.</div>'; return; }

  A.$("lg-ok").disabled = true;
  try {
    if (modoCriar){
      const { error } = await A.sb.auth.signUp({
        email, password: senha, options: { data: { nome_guerra: nome.toUpperCase() } }
      });
      if (error) throw error;
      msg.innerHTML = '<div class="okmsg">Acesso criado. Se o projeto exigir confirmação por '
        + "e-mail, abra a mensagem e clique no link. Depois volte e entre.</div>";
    } else {
      const { error } = await A.sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
    }
  } catch (e) {
    msg.innerHTML = '<div class="err">' + A.esc(A.explicar(e)) + "</div>";
  } finally { A.$("lg-ok").disabled = false; }
};

A.carregarPerfil = async () => {
  const { data } = await A.sb.from("perfis").select("*").eq("id", A.sessao.user.id).maybeSingle();
  A.perfil = data || { nome_guerra: A.sessao.user.email, papel: "consulta" };
  A.$("ch-nome").textContent = A.perfil.nome_guerra;
  const chip = A.$("ch-papel");
  chip.textContent = A.perfil.papel;
  chip.className = "chip" + (A.perfil.papel === "chefe" ? " chefe" : "");
  const b = A.$("banner");
  if (!A.pode()){
    b.hidden = false; b.className = "banner info";
    b.innerHTML = "<b>Perfil de consulta.</b> Você vê tudo, mas não registra nada. "
      + "O chefe da seção libera em Supabase → Table Editor → perfis, trocando seu papel para <b>operador</b>.";
  } else b.hidden = true;
};

/* -------------------------------------------------------------- tempo real */
A.assinar = () => {
  if (window.__canal) return;
  const recarga = () => {
    clearTimeout(window.__tmr);
    window.__tmr = setTimeout(A.recarregar, 800);
  };
  let c = A.sb.channel("smo");
  ["lotes","movimentos","itens","equipamentos","manutencoes","pedidos","pedido_itens","missoes"]
    .forEach(t => { c = c.on("postgres_changes", { event:"*", schema:"public", table:t }, recarga); });
  window.__canal = c.subscribe();
};

/* ---------------------------------------------------------------- arranque */
A.iniciar = async () => {
  if (!window.supabase || /COLE_AQUI/.test(window.SUPABASE_URL || "")){
    A.telaConfig("Falta configurar",
      "<p>Abra o <b>config.js</b> e cole a URL do projeto e a chave <b>anon public</b>, "
      + "de Project Settings → Data API. Depois recarregue.</p>");
    return;
  }
  const url = A.limparURL(window.SUPABASE_URL);
  const problema = A.conferirURL(url);
  if (problema){ A.telaConfig("URL do projeto parece errada", problema); return; }

  A.sb = window.supabase.createClient(url, String(window.SUPABASE_ANON_KEY).trim(), {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  A.ligarLogin();
  window.addEventListener("online",  A.atualizaRede);
  window.addEventListener("offline", A.atualizaRede);
  A.$("bt-sair").onclick = async () => {
    if (window.__canal){ A.sb.removeChannel(window.__canal); window.__canal = null; }
    await A.sb.auth.signOut();
    location.reload();
  };

  const { data } = await A.sb.auth.getSession();
  await A.aoMudarSessao(data.session);
  A.sb.auth.onAuthStateChange((_e, s) => A.aoMudarSessao(s));

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
};

let montado = false;
A.aoMudarSessao = async sessao => {
  A.sessao = sessao;
  if (!sessao){
    A.perfil = null;
    A.$("tela-login").hidden = false;
    A.$("tela-app").hidden = true;
    return;
  }
  A.$("tela-login").hidden = true;
  A.$("tela-app").hidden = false;
  await A.carregarPerfil();
  A.atualizaRede();
  await A.recarregar();
  if (!montado){ montado = true; A.irPara("painel"); }
  A.assinar();
};
