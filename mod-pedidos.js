/* =====================================================================
   MÓDULO PEDIDOS
   O ponto central é o recebimento parcial: cada chegada vira lote de
   verdade no estoque, com validade, e empurra a situação do pedido
   sozinha. Ninguém digita "parcial" ou "concluído" à mão.
   ===================================================================== */
"use strict";

(() => {
const abertos = new Set();
let fSit = "abertos";

const SIT = {
  rascunho:"Rascunho", solicitado:"Solicitado", empenhado:"Empenhado",
  parcial:"Recebimento parcial", concluido:"Concluído", cancelado:"Cancelado"
};
let PEDIDOS = [], ITENS_PED = {};

const atrasado = p => ["solicitado","empenhado","parcial"].includes(p.situacao)
  && p.previsao && A.diasAte(p.previsao) < 0;

async function carregar(){
  const { data, error } = await A.sb.from("v_pedidos")
    .select("*").order("data_pedido", { ascending:false });
  PEDIDOS = error ? [] : (data || []);
  return !error;
}

/* ----------------------------------------------------------------- render */
async function render(sec){
  if (A.filtros.situacao){ fSit = A.filtros.situacao; A.filtros = {}; }
  sec.innerHTML = '<div class="skel">Carregando pedidos…</div>';
  const ok = await carregar();
  if (!ok){
    sec.innerHTML = '<div class="panel"><div class="empty"><b>Módulo de pedidos não instalado.</b>'
      + "Rode <b>sql/03-modulos.sql</b> no SQL Editor do Supabase.</div></div>";
    return;
  }
  const pode = A.pode();
  sec.innerHTML = '<div class="cards" id="pd-cards"></div>'
    + '<div class="bar"><button class="btn" id="pd-novo"' + (pode ? "" : " disabled")
    + ">Novo pedido</button>"
    + '<select class="field auto" id="pd-sit">'
    + '<option value="abertos"' + (fSit === "abertos" ? " selected" : "") + ">Em andamento</option>"
    + '<option value="todos"' + (fSit === "todos" ? " selected" : "") + ">Todos</option>"
    + Object.entries(SIT).map(([v,t]) =>
        '<option value="' + v + '"' + (v === fSit ? " selected" : "") + ">" + t + "</option>").join("")
    + "</select></div>"
    + '<div class="panel"><div class="phead"><h2>Pedidos</h2><span class="cnt" id="pd-cnt"></span></div>'
    + '<div id="pd-tabela"></div></div>';

  desenharCards();
  desenharTabela();
  A.$("pd-sit").onchange = e => { fSit = e.target.value; desenharTabela(); };
  A.$("pd-novo").onclick = () => modalPedido();
}

function desenharCards(){
  const ab = PEDIDOS.filter(p => ["solicitado","empenhado","parcial"].includes(p.situacao));
  const cards = [
    { c:"n", n:ab.length, t:"pedidos em andamento", u:"solicitados, empenhados ou parciais", f:"abertos" },
    { c:"a", n:PEDIDOS.filter(p => p.situacao === "parcial").length, t:"com recebimento parcial",
      u:"material chegando aos poucos", f:"parcial" },
    { c:"v", n:PEDIDOS.filter(atrasado).length, t:"passaram da previsão",
      u:"cobrar fornecedor ou setor", f:"abertos" },
    { c:"o", n:PEDIDOS.filter(p => p.situacao === "concluido").length, t:"concluídos",
      u:"material todo recebido", f:"concluido" }
  ];
  A.$("pd-cards").innerHTML = cards.map(c =>
    '<button class="card ' + c.c + '" data-f="' + c.f + '"><div class="n num">' + c.n + "</div>"
    + '<div class="t">' + c.t + '</div><div class="u">' + c.u + "</div></button>").join("");
  A.$("pd-cards").querySelectorAll("[data-f]").forEach(b =>
    b.onclick = () => { fSit = b.dataset.f; A.$("pd-sit").value = fSit; desenharTabela(); });
}

function filtrados(){
  if (fSit === "todos") return PEDIDOS;
  if (fSit === "abertos") return PEDIDOS.filter(p => ["solicitado","empenhado","parcial"].includes(p.situacao));
  return PEDIDOS.filter(p => p.situacao === fSit);
}

function desenharTabela(){
  const lista = filtrados();
  A.$("pd-cnt").textContent = lista.length + " de " + PEDIDOS.length;
  if (!lista.length){
    A.$("pd-tabela").innerHTML = '<div class="empty"><b>Nenhum pedido nesse filtro.</b>'
      + "Cadastre um pedido para acompanhar a chegada do material.</div>";
    return;
  }
  let h = "<table><thead><tr><th>Pedido</th><th>Fornecedor</th><th>Situação</th>"
    + "<th class='r'>Itens</th><th>Recebido</th><th>Previsão</th></tr></thead><tbody>";
  lista.forEach(p => {
    h += '<tr class="item" data-id="' + p.id + '">'
      + "<td><div class='iname'><span class='chev'>" + (abertos.has(p.id) ? "▾" : "▸") + "</span>"
      + A.esc(p.descricao) + "</div><div class='icat' style='padding-left:16px'>"
      + (p.numero ? A.esc(p.numero) + " · " : "") + A.brData(p.data_pedido) + "</div></td>"
      + "<td data-rot='Fornecedor'>" + A.esc(p.fornecedor || "—") + "</td>"
      + '<td><span class="tag ' + p.situacao + '">' + SIT[p.situacao] + "</span></td>"
      + "<td class='r num' data-rot='Itens'>" + p.qtd_itens + "</td>"
      + "<td data-rot='Recebido'>" + A.graf.progresso(p.percentual,
          A.nfmt(p.total_recebido) + "/" + A.nfmt(p.total_solicitado)) + "</td>"
      + "<td data-rot='Previsão'>" + (p.previsao
          ? '<span class="tag ' + (atrasado(p) ? "atrasado" : "s") + '">' + A.brData(p.previsao) + "</span>"
          : "—") + "</td></tr>";
    if (abertos.has(p.id)) h += '<tr class="sub"><td colspan="6"><div id="pd-det-' + p.id
      + '"><div class="skel">Carregando itens…</div></div></td></tr>';
  });
  A.$("pd-tabela").innerHTML = h + "</tbody></table>";

  document.querySelectorAll("#sec-pedidos tr.item").forEach(tr => tr.onclick = () => {
    const id = Number(tr.dataset.id);
    abertos.has(id) ? abertos.delete(id) : abertos.add(id);
    desenharTabela();
  });
  lista.filter(p => abertos.has(p.id)).forEach(p => carregarItens(p));
}

/* --------------------------------------------------- itens e recebimento */
async function carregarItens(p){
  const cx = A.$("pd-det-" + p.id);
  if (!cx) return;
  const { data, error } = await A.sb.from("pedido_itens")
    .select("*, itens(nome, categoria, unidade)").eq("pedido_id", p.id).order("id");
  if (!A.$("pd-det-" + p.id)) return;
  if (error){ cx.innerHTML = '<div class="err" style="margin:14px">' + A.esc(A.explicar(error)) + "</div>"; return; }
  ITENS_PED[p.id] = data || [];

  const pode = A.pode() && !["cancelado","rascunho"].includes(p.situacao);
  let h = "";
  if (!data.length){
    h = "<div style='padding:14px 16px 4px 42px;font-size:12.5px;color:var(--muted)'>"
      + "Nenhum item neste pedido ainda.</div>";
  } else {
    h = "<table class='ltable'><thead><tr><th>Item</th><th class='r'>Solicitado</th>"
      + "<th class='r'>Recebido</th><th class='r'>Falta</th><th>Andamento</th><th></th></tr></thead><tbody>";
    data.forEach(pi => {
      const falta = pi.qtd_solicitada - pi.qtd_recebida;
      const pct = pi.qtd_solicitada ? (pi.qtd_recebida / pi.qtd_solicitada * 100) : 0;
      h += "<tr><td><span class='lnum'>" + A.esc(pi.itens ? pi.itens.nome : "—") + "</span></td>"
        + "<td class='r num' data-rot='Solicitado'>" + A.nfmt(pi.qtd_solicitada) + "</td>"
        + "<td class='r num' data-rot='Recebido'><b>" + A.nfmt(pi.qtd_recebida) + "</b></td>"
        + "<td class='r num' data-rot='Falta' style='color:" + (falta ? "var(--d30)" : "var(--ok)") + "'>"
        + A.nfmt(falta) + "</td>"
        + "<td data-rot='Andamento'>" + A.graf.progresso(pct) + "</td>"
        + "<td class='r'>" + (pode && falta > 0
            ? "<button class='btn sm' data-receber='" + pi.id + "'>Receber</button>" : "") + "</td></tr>";
    });
    h += "</tbody></table>";
  }

  h += '<div class="acoes">' + (A.pode()
    ? "<button class='btn sm sec' data-additem='" + p.id + "'>Acrescentar item</button>"
      + (["solicitado","empenhado","rascunho"].includes(p.situacao)
          ? "<button class='btn sm sec' data-sit='" + p.id + "'>Mudar situação</button>" : "")
    : "") + (p.obs ? "<span style='font-size:12px;color:var(--muted);align-self:center'>"
      + A.esc(p.obs) + "</span>" : "") + "</div>";

  cx.innerHTML = h;
  cx.querySelectorAll("[data-receber]").forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const pi = (ITENS_PED[p.id] || []).find(x => x.id === Number(b.dataset.receber));
    if (pi) modalReceber(p, pi);
  });
  cx.querySelectorAll("[data-additem]").forEach(b =>
    b.onclick = ev => { ev.stopPropagation(); modalAddItem(p); });
  cx.querySelectorAll("[data-sit]").forEach(b =>
    b.onclick = ev => { ev.stopPropagation(); modalSituacao(p); });
}

/** Recebimento: o formulário do lote, dentro do pedido. */
function modalReceber(p, pi){
  const falta = pi.qtd_solicitada - pi.qtd_recebida;
  const d1 = new Date(A.HOJE); d1.setFullYear(d1.getFullYear() + 1);
  A.modal("Receber material — " + (pi.itens ? pi.itens.nome : ""),
    '<div id="rc-msg"></div>'
    + "<p style='font-size:12.5px;color:var(--muted);margin:0 0 14px'>"
    + "Pedido <b>" + A.esc(p.descricao) + "</b>. Solicitado <b class='num'>" + A.nfmt(pi.qtd_solicitada)
    + "</b>, já recebido <b class='num'>" + A.nfmt(pi.qtd_recebida) + "</b>, faltam <b class='num'>"
    + A.nfmt(falta) + "</b>.</p>"
    + '<div class="grid2"><div class="row"><label class="lab" for="rc-qtd">Quantidade que chegou</label>'
    + '<input class="field num" id="rc-qtd" type="number" inputmode="numeric" min="1" max="' + falta
    + '" value="' + falta + '"></div>'
    + '<div class="row"><label class="lab" for="rc-lote">Número do lote</label>'
    + '<input class="field" id="rc-lote" placeholder="da embalagem"></div></div>'
    + '<div class="grid2"><div class="row"><label class="lab" for="rc-val">Validade</label>'
    + '<input class="field" id="rc-val" type="date" value="' + d1.toISOString().slice(0,10) + '"></div>'
    + '<div class="row"><label class="lab" for="rc-fab">Fabricante</label>'
    + '<input class="field" id="rc-fab" placeholder="opcional"></div></div>'
    + '<div class="row"><label class="lab" for="rc-nf">Nota fiscal</label>'
    + '<input class="field" id="rc-nf" placeholder="opcional"></div>'
    + '<div class="hint">Ao confirmar, o material entra no estoque como lote com validade, e o pedido '
    + "passa sozinho para parcial ou concluído.</div>",
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn" id="rc-ok">Confirmar recebimento</button>');

  A.$("rc-ok").onclick = () => {
    const qtd = parseInt(A.$("rc-qtd").value, 10);
    const lote = A.$("rc-lote").value.trim();
    if (!qtd || qtd <= 0 || !lote){
      A.$("rc-msg").innerHTML = '<div class="err">Informe a quantidade e o número do lote da embalagem.</div>';
      return;
    }
    A.salvar("rc-ok", "rc-msg", async () => {
      const { error } = await A.sb.rpc("receber_item_pedido", {
        p_pedido_item: pi.id, p_qtd: qtd, p_numero_lote: lote,
        p_validade: A.$("rc-val").value || null,
        p_fabricante: A.$("rc-fab").value.trim() || null,
        p_nota_fiscal: A.$("rc-nf").value.trim() || null
      });
      if (error) throw error;
      await carregar();
    }, A.nfmt(qtd) + " un recebidas e lançadas no estoque.");
  };
}

/* ------------------------------------------------------------ novo pedido */
function modalPedido(){
  let linhas = [{ item:"", qtd:"" }];

  const htmlLinhas = () => linhas.map((l,i) =>
    '<div class="linhaitem"><select class="field" data-li="' + i + '">'
    + '<option value="">Escolha o item…</option>' + A.opcoesItens(l.item) + "</select>"
    + '<input class="field num" type="number" min="1" placeholder="qtd" value="' + A.esc(l.qtd)
    + '" data-lq="' + i + '">'
    + '<button class="btn sm sec" data-lx="' + i + '" aria-label="Remover">&times;</button></div>').join("");

  const corpo = () =>
    '<div id="pn-msg"></div>'
    + '<div class="row"><label class="lab" for="pn-desc">Descrição do pedido</label>'
    + '<input class="field" id="pn-desc" placeholder="ex.: Aquisição de material de curativo 2026"></div>'
    + '<div class="grid3"><div class="row"><label class="lab" for="pn-num">Número do processo</label>'
    + '<input class="field" id="pn-num" placeholder="SEI, opcional"></div>'
    + '<div class="row"><label class="lab" for="pn-forn">Fornecedor</label>'
    + '<input class="field" id="pn-forn" placeholder="opcional"></div>'
    + '<div class="row"><label class="lab" for="pn-prev">Previsão de entrega</label>'
    + '<input class="field" id="pn-prev" type="date"></div></div>'
    + '<div class="row"><label class="lab">Itens do pedido</label>'
    + '<div id="pn-linhas">' + htmlLinhas() + "</div>"
    + '<button class="btn sm sec" id="pn-add" type="button">Acrescentar linha</button></div>'
    + '<div class="row"><label class="lab" for="pn-obs">Observação</label>'
    + '<input class="field" id="pn-obs" placeholder="opcional"></div>';

  A.modal("Novo pedido", corpo(),
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn" id="pn-ok">Salvar pedido</button>', true);

  const ligar = () => {
    A.$("pn-linhas").innerHTML = htmlLinhas();
    A.$("pn-linhas").querySelectorAll("[data-li]").forEach(s =>
      s.onchange = () => { linhas[+s.dataset.li].item = s.value; });
    A.$("pn-linhas").querySelectorAll("[data-lq]").forEach(i =>
      i.oninput = () => { linhas[+i.dataset.lq].qtd = i.value; });
    A.$("pn-linhas").querySelectorAll("[data-lx]").forEach(b =>
      b.onclick = () => {
        if (linhas.length > 1) linhas.splice(+b.dataset.lx, 1); else linhas = [{item:"",qtd:""}];
        ligar();
      });
  };
  ligar();
  A.$("pn-add").onclick = () => { linhas.push({ item:"", qtd:"" }); ligar(); };

  A.$("pn-ok").onclick = () => {
    const desc = A.$("pn-desc").value.trim();
    const validas = linhas.filter(l => l.item && parseInt(l.qtd,10) > 0);
    if (!desc){ A.$("pn-msg").innerHTML = '<div class="err">Informe a descrição do pedido.</div>'; return; }
    if (!validas.length){
      A.$("pn-msg").innerHTML = '<div class="err">Acrescente pelo menos um item com quantidade.</div>'; return;
    }
    A.salvar("pn-ok", "pn-msg", async () => {
      const ins = await A.sb.from("pedidos").insert({
        descricao: desc,
        numero: A.$("pn-num").value.trim() || null,
        fornecedor: A.$("pn-forn").value.trim() || null,
        previsao: A.$("pn-prev").value || null,
        obs: A.$("pn-obs").value.trim() || null,
        situacao: "solicitado"
      }).select().single();
      if (ins.error) throw ins.error;
      const r = await A.sb.from("pedido_itens").insert(validas.map(l => ({
        pedido_id: ins.data.id, item_id: Number(l.item), qtd_solicitada: parseInt(l.qtd,10)
      })));
      if (r.error) throw r.error;
      abertos.add(ins.data.id);
      await carregar();
    }, "Pedido registrado com " + validas.length + (validas.length === 1 ? " item." : " itens."));
  };
}

function modalAddItem(p){
  A.modal("Acrescentar item ao pedido",
    '<div id="ai-msg"></div>'
    + '<div class="row"><label class="lab" for="ai-item">Item</label>'
    + '<select class="field" id="ai-item">' + A.opcoesItens() + "</select></div>"
    + '<div class="row"><label class="lab" for="ai-qtd">Quantidade solicitada</label>'
    + '<input class="field num" id="ai-qtd" type="number" min="1" placeholder="0"></div>',
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn" id="ai-ok">Acrescentar</button>');

  A.$("ai-ok").onclick = () => {
    const qtd = parseInt(A.$("ai-qtd").value, 10);
    if (!qtd || qtd <= 0){
      A.$("ai-msg").innerHTML = '<div class="err">Informe uma quantidade maior que zero.</div>'; return;
    }
    A.salvar("ai-ok", "ai-msg", async () => {
      const { error } = await A.sb.from("pedido_itens").insert({
        pedido_id: p.id, item_id: Number(A.$("ai-item").value), qtd_solicitada: qtd });
      if (error) throw error;
      await carregar();
    }, "Item acrescentado ao pedido.");
  };
}

function modalSituacao(p){
  A.modal("Mudar situação do pedido",
    '<div id="ps-msg"></div>'
    + "<p style='font-size:12.5px;color:var(--muted);margin:0 0 14px'>"
    + "Parcial e concluído não aparecem aqui de propósito: são calculados pelo recebimento.</p>"
    + '<div class="row"><label class="lab" for="ps-sit">Situação</label>'
    + '<select class="field" id="ps-sit">'
    + ["rascunho","solicitado","empenhado","cancelado"].map(v =>
        '<option value="' + v + '"' + (v === p.situacao ? " selected" : "") + ">" + SIT[v] + "</option>").join("")
    + "</select></div>",
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn" id="ps-ok">Salvar</button>');

  A.$("ps-ok").onclick = () => A.salvar("ps-ok", "ps-msg", async () => {
    const { error } = await A.sb.rpc("mudar_situacao_pedido", {
      p_pedido: p.id, p_situacao: A.$("ps-sit").value });
    if (error) throw error;
    await carregar();
  }, "Situação atualizada.");
}

/* ---------------------------------------------------------------- registro */
A.pedidos = { carregar, lista: () => PEDIDOS };
A.registrarAba("pedidos", "Pedidos", render, () => {
  const n = (A.resumo && A.resumo.pedidos) ? A.resumo.pedidos.abertos : 0;
  const atr = (A.resumo && A.resumo.pedidos) ? A.resumo.pedidos.atrasados : 0;
  return { qtd: n, urgente: atr > 0 };
});
})();
