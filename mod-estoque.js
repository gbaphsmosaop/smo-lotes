/* =====================================================================
   MÓDULO ESTOQUE — lotes, validade, baixa FEFO, descarte, código de barras
   ===================================================================== */
"use strict";

(() => {
const abertos = new Set();
let busca = "", filtro = "todos", cat = "todas";

/* ------------------------------------------------------------- horizonte */
const ZONAS = [
  { k:"v", rot:"Vencido",         ini:0,  fim:18 },
  { k:"a", rot:"Até 30 dias",     ini:18, fim:40 },
  { k:"b", rot:"31 a 90 dias",    ini:40, fim:62 },
  { k:"o", rot:"Mais de 90 dias", ini:62, fim:100 }
];
const CORZ = { v:"#E0555E", a:"#F0913E", b:"#E3C64A", o:"#4FBF8B" };

/* Eixo comprimido: o curto prazo ganha mais espaço, porque é nele que
   existe decisão a tomar. */
function posicao(d){
  if (d < 0)   return 2 + (Math.max(d,-180) + 180) / 180 * 14;
  if (d <= 30) return 18 + (d / 30) * 22;
  if (d <= 90) return 40 + ((d - 30) / 60) * 22;
  return 62 + (Math.min(d, 730) - 90) / 640 * 36;
}

function htmlHorizonte(){
  return '<section class="horizon"><h2>Horizonte de validade</h2>'
    + '<p class="lead">Cada marcador é um lote em estoque, posicionado pela data de vencimento.</p>'
    + '<div class="track" id="track"></div><div class="tip" id="tip"></div></section>';
}

function desenharHorizonte(){
  const track = A.$("track");
  if (!track) return;
  const comVal = A.lotes.filter(l => l.validade);
  const cont = { v:0, a:0, b:0, o:0 };
  comVal.forEach(l => cont[A.faixa(l.validade)]++);

  let h = "";
  ZONAS.forEach(z => {
    h += '<div class="zone" style="left:' + z.ini + "%;width:" + (z.fim - z.ini) + '%">'
      + '<div class="zcount num" style="color:' + CORZ[z.k] + '">' + cont[z.k]
      + "<small>" + (cont[z.k] === 1 ? "lote" : "lotes") + "</small></div>"
      + '<div class="zlabel">' + z.rot + "</div></div>";
  });
  h += '<div class="today" style="left:18%"></div>';

  const marc = comVal.map(l => ({ l, x: posicao(A.diasAte(l.validade)) })).sort((a,b) => a.x - b.x);
  const ocup = [];
  marc.forEach(m => {
    let i = 0;
    while (ocup[i] !== undefined && m.x - ocup[i] < 2.4) i++;
    ocup[i] = m.x; m.lane = i % 5;
  });
  marc.forEach(m => {
    const it = A.itens.find(x => x.id === m.l.item_id);
    h += '<button class="dot ' + A.faixa(m.l.validade) + '" style="left:' + m.x
      + "%;top:" + (44 + m.lane * 12) + 'px" data-lote="' + m.l.id
      + '" aria-label="' + A.esc((it ? it.nome : "") + " lote " + m.l.numero) + '"></button>';
  });
  track.innerHTML = h;

  track.querySelectorAll(".dot").forEach(d => {
    d.addEventListener("mouseenter", e => tip(e.currentTarget));
    d.addEventListener("focus",      e => tip(e.currentTarget));
    d.addEventListener("mouseleave", semTip);
    d.addEventListener("blur",       semTip);
    d.addEventListener("click", e => {
      const l = A.lotes.find(x => String(x.id) === e.currentTarget.dataset.lote);
      if (!l) return;
      abertos.add(l.item_id); busca = ""; filtro = "todos"; cat = "todas";
      render(A.$("sec-estoque"));
      const tr = document.querySelector('tr.item[data-id="' + l.item_id + '"]');
      if (tr) tr.scrollIntoView({ block:"center", behavior:"smooth" });
    });
  });
}

function tip(el){
  const l = A.lotes.find(x => String(x.id) === el.dataset.lote);
  if (!l) return;
  const it = A.itens.find(x => x.id === l.item_id);
  const d = A.diasAte(l.validade);
  const t = A.$("tip");
  t.innerHTML = "<b>" + A.esc(it ? it.nome : "—") + "</b>"
    + '<div class="l">Lote ' + A.esc(l.numero) + (l.fabricante ? " · " + A.esc(l.fabricante) : "") + "</div>"
    + '<div style="margin-top:5px"><span class="tag ' + A.faixa(l.validade) + '">'
    + A.brData(l.validade) + "</span></div>"
    + '<div class="l" style="margin-top:4px">' + A.nfmt(l.qtd_atual) + " un · "
    + (d < 0 ? "vencido há " + Math.abs(d) + " d" : "vence em " + d + " d") + "</div>";
  t.style.display = "block";
  const r = el.getBoundingClientRect(), tr = t.getBoundingClientRect();
  const hz = document.querySelector(".horizon").getBoundingClientRect();
  let left = r.left - hz.left + 14;
  if (left + tr.width > hz.width - 8) left = r.left - hz.left - tr.width - 14;
  t.style.left = Math.max(8, left) + "px";
  t.style.top  = (r.top - hz.top + 16) + "px";
}
const semTip = () => { const t = A.$("tip"); if (t) t.style.display = "none"; };

/* ---------------------------------------------------------------- filtros */
function filtrados(){
  const q = busca.trim().toLowerCase();
  return A.itens.filter(it => {
    if (cat !== "todas" && it.categoria !== cat) return false;
    if (q){
      const achaLote = A.lotes.some(l => l.item_id === it.id && String(l.numero).toLowerCase().includes(q));
      if (!it.nome.toLowerCase().includes(q) && !achaLote) return false;
    }
    const lotes = A.lotesDoItem(it.id);
    if (filtro === "comlote") return lotes.length > 0;
    if (filtro === "semlote") return lotes.length === 0;
    if (filtro === "vencido") return lotes.some(l => A.faixa(l.validade) === "v");
    if (filtro === "d30")     return lotes.some(l => A.faixa(l.validade) === "a");
    if (filtro === "d90")     return lotes.some(l => ["a","b"].includes(A.faixa(l.validade)));
    if (filtro === "diverg")  return lotes.length > 0 && it.divergencia !== 0;
    if (filtro === "critico") return it.situacao === "CRÍTICO" || it.situacao === "ZERADO";
    return true;
  });
}

/* ----------------------------------------------------------------- render */
function render(sec){
  if (A.filtros.filtro){ filtro = A.filtros.filtro; A.filtros = {}; }
  const cats = Array.from(new Set(A.itens.map(i => i.categoria))).sort();
  const pode = A.pode();

  sec.innerHTML = htmlHorizonte()
    + '<div class="cards" id="est-cards"></div>'
    + '<div class="bar">'
    + '<button class="btn scan" id="bt-scan"' + (pode ? "" : " disabled") + ">Ler código da caixa</button>"
    + '<button class="btn" id="bt-entrada"' + (pode ? "" : " disabled") + ">Registrar entrada</button>"
    + '<button class="btn" id="bt-saida"'   + (pode ? "" : " disabled") + ">Dar baixa</button>"
    + '<button class="btn sec" id="bt-item"' + (pode ? "" : " disabled") + ">Item novo</button>"
    + '<button class="btn sec" id="bt-hist">Histórico</button>'
    + '<button class="btn sec" id="bt-csv">CSV</button></div>'
    + '<div class="bar"><input class="field grow" id="busca" type="search" value="' + A.esc(busca)
    + '" placeholder="Buscar item ou número de lote">'
    + '<select class="field auto" id="filtro">'
    + ['todos|Todos os itens','comlote|Com lote cadastrado','semlote|Sem lote cadastrado',
       'vencido|Com lote vencido','d30|Vencendo em 30 dias','d90|Vencendo em 90 dias',
       'critico|Situação crítica','diverg|Saldo divergente da planilha']
      .map(o => { const [v,t] = o.split("|");
        return '<option value="' + v + '"' + (v === filtro ? " selected" : "") + ">" + t + "</option>"; }).join("")
    + "</select>"
    + '<select class="field auto" id="cat"><option value="todas">Todas as categorias</option>'
    + cats.map(c => '<option' + (c === cat ? " selected" : "") + ">" + A.esc(c) + "</option>").join("")
    + "</select></div>"
    + '<div class="panel"><div class="phead"><h2>Itens</h2><span class="cnt" id="cnt"></span></div>'
    + '<div id="tabela"></div></div>';

  desenharHorizonte();
  desenharCards();
  desenharTabela();

  A.$("busca").oninput   = e => { busca = e.target.value; desenharTabela(); };
  A.$("filtro").onchange = e => { filtro = e.target.value; desenharTabela(); };
  A.$("cat").onchange    = e => { cat = e.target.value; desenharTabela(); };
  A.$("bt-scan").onclick    = abrirLeitor;
  A.$("bt-entrada").onclick = () => modalEntrada({});
  A.$("bt-saida").onclick   = () => modalSaida();
  A.$("bt-item").onclick    = () => modalItem({});
  A.$("bt-hist").onclick    = modalHistorico;
  A.$("bt-csv").onclick     = baixarCSV;
  window.addEventListener("resize", desenharHorizonte);
}

function desenharCards(){
  const g = k => A.lotes.filter(l => A.faixa(l.validade) === k);
  const un = a => a.reduce((s,l) => s + l.qtd_atual, 0);
  const semLote = A.itens.filter(i => i.controla_validade && i.qtd_lotes === 0).length;
  const cards = [
    { c:"v", n:g("v").length, t:"lotes vencidos",          u:A.nfmt(un(g("v"))) + " unidades a descartar", f:"vencido" },
    { c:"a", n:g("a").length, t:"vencem em até 30 dias",   u:A.nfmt(un(g("a"))) + " unidades a priorizar", f:"d30" },
    { c:"b", n:g("b").length, t:"vencem em 31 a 90 dias",  u:A.nfmt(un(g("b"))) + " unidades em observação", f:"d90" },
    { c:"s", n:semLote,       t:"itens sem lote cadastrado", u:"pendentes de migração da planilha", f:"semlote" }
  ];
  A.$("est-cards").innerHTML = cards.map(c =>
    '<button class="card ' + c.c + '" data-f="' + c.f + '"><div class="n num">' + c.n + "</div>"
    + '<div class="t">' + c.t + '</div><div class="u">' + c.u + "</div></button>").join("");
  A.$("est-cards").querySelectorAll("[data-f]").forEach(b =>
    b.onclick = () => { filtro = b.dataset.f; busca = ""; render(A.$("sec-estoque"));
      document.querySelector(".panel").scrollIntoView({ behavior:"smooth", block:"start" }); });
}

function desenharTabela(){
  const lista = filtrados();
  A.$("cnt").textContent = lista.length + (lista.length === 1 ? " item" : " itens") + " de " + A.itens.length;
  if (!lista.length){
    A.$("tabela").innerHTML = '<div class="empty"><b>Nenhum item nesse filtro.</b>'
      + "Ajuste a busca ou escolha outro filtro.</div>";
    return;
  }
  let h = "<table><thead><tr><th>Item</th><th class='r'>Saldo por lote</th><th class='r'>Ideal</th>"
    + "<th class='r'>Lotes</th><th>Vence primeiro</th><th>Situação</th><th class='r'>Planilha</th>"
    + "</tr></thead><tbody>";
  lista.forEach(it => {
    const lotes = A.lotesDoItem(it.id);
    const prox  = lotes.find(l => A.faixa(l.validade) !== "v") || lotes[0];
    const foto  = A.urlFoto(it.foto_path);
    h += '<tr class="item" data-id="' + it.id + '">'
      + "<td><div class='iname'><span class='chev'>" + (abertos.has(it.id) ? "▾" : "▸") + "</span>"
      + (foto ? '<img class="foto" src="' + A.esc(foto) + '" alt="" loading="lazy">'
              : '<span class="foto ph">sem<br>foto</span>')
      + "<span>" + A.esc(it.nome) + "</span></div>"
      + "<div class='icat' style='padding-left:54px'>" + A.esc(it.categoria)
      + (it.controla_validade ? "" : " · não controla validade") + "</div></td>"
      + "<td class='r num' data-rot='Saldo'><b>" + (lotes.length ? A.nfmt(it.saldo) : "—") + "</b></td>"
      + "<td class='r num' data-rot='Ideal' style='color:var(--muted)'>"
      + (it.estoque_ideal ? A.nfmt(it.estoque_ideal) : "—") + "</td>"
      + "<td class='r num' data-rot='Lotes'>" + (it.qtd_lotes || "—") + "</td>"
      + "<td data-rot='Vence'>" + (prox
          ? '<span class="tag ' + A.faixa(prox.validade) + '">' + A.brData(prox.validade) + "</span>"
          : '<span class="tag s">sem lote</span>') + "</td>"
      + '<td><span class="tag ' + A.esc(it.situacao) + '">' + A.esc(it.situacao) + "</span></td>"
      + "<td class='r num' data-rot='Planilha' style='color:var(--muted)'>" + A.nfmt(it.saldo_legado)
      + (lotes.length && it.divergencia !== 0
          ? '<div class="diverg">' + (it.divergencia > 0 ? "+" : "") + A.nfmt(it.divergencia) + "</div>" : "")
      + "</td></tr>";
    if (abertos.has(it.id)) h += '<tr class="sub"><td colspan="7">' + htmlLotes(it, lotes) + "</td></tr>";
  });
  A.$("tabela").innerHTML = h + "</tbody></table>";

  document.querySelectorAll("#sec-estoque tr.item").forEach(tr => tr.onclick = () => {
    const id = Number(tr.dataset.id);
    abertos.has(id) ? abertos.delete(id) : abertos.add(id);
    desenharTabela();
  });
  document.querySelectorAll("#sec-estoque [data-descarte]").forEach(b =>
    b.onclick = e => { e.stopPropagation(); modalDescarte(Number(b.dataset.descarte)); });
  document.querySelectorAll("#sec-estoque [data-novolote]").forEach(b =>
    b.onclick = e => { e.stopPropagation(); modalEntrada({ itemId:Number(b.dataset.novolote) }); });
  document.querySelectorAll("#sec-estoque [data-foto]").forEach(b =>
    b.onclick = e => { e.stopPropagation(); escolherFoto(Number(b.dataset.foto)); });
  document.querySelectorAll("#sec-estoque [data-baixa]").forEach(b =>
    b.onclick = e => { e.stopPropagation(); modalSaida(Number(b.dataset.baixa)); });
}

function htmlLotes(it, lotes){
  const pode = A.pode();
  const acoes = '<div class="acoes">' + (pode
    ? "<button class='btn sm sec' data-novolote='" + it.id + "'>Registrar lote</button>"
      + (lotes.length ? "<button class='btn sm sec' data-baixa='" + it.id + "'>Dar baixa</button>" : "")
      + "<button class='btn sm sec' data-foto='" + it.id + "'>"
      + (it.foto_path ? "Trocar foto" : "Tirar foto") + "</button>" : "") + "</div>";

  if (!lotes.length){
    return "<div style='padding:14px 16px 4px 42px;font-size:12.5px;color:var(--muted)'>"
      + "Nenhum lote cadastrado. A planilha registrava <b class='num'>" + A.nfmt(it.saldo_legado)
      + "</b> unidades, sem identificação de lote nem de validade.</div>" + acoes;
  }
  let h = "<table class='ltable'><thead><tr><th>Lote</th><th>Fabricante</th><th>Validade</th>"
    + "<th class='r'>Saldo</th><th class='r'>Entrada</th><th>NF</th><th></th></tr></thead><tbody>";
  lotes.forEach((l, i) => {
    const f = A.faixa(l.validade), d = A.diasAte(l.validade);
    const primeiro = f !== "v" && !lotes.slice(0,i).some(x => A.faixa(x.validade) !== "v");
    h += "<tr><td><span class='lnum'>" + A.esc(l.numero) + "</span>"
      + (primeiro ? '<span class="fefo">SAI PRIMEIRO</span>' : "") + "</td>"
      + "<td data-rot='Fabricante'>" + A.esc(l.fabricante || "—") + "</td>"
      + '<td data-rot="Validade"><span class="tag ' + f + '">' + A.brData(l.validade) + "</span>"
      + "<div style='font-size:11px;color:var(--muted)'>"
      + (d === null ? "" : d < 0 ? "vencido há " + Math.abs(d) + " dias" : "faltam " + d + " dias") + "</div></td>"
      + "<td class='r num' data-rot='Saldo'><b>" + A.nfmt(l.qtd_atual) + "</b> / " + A.nfmt(l.qtd_inicial) + "</td>"
      + "<td class='r num' data-rot='Entrada' style='color:var(--muted)'>" + A.brData(l.data_entrada) + "</td>"
      + "<td data-rot='NF' style='color:var(--muted)'>" + A.esc(l.nota_fiscal || "—") + "</td>"
      + "<td class='r'>" + (f === "v" && pode
          ? "<button class='btn sm danger' data-descarte='" + l.id + "'>Descartar</button>" : "") + "</td></tr>";
  });
  return h + "</tbody></table>" + acoes;
}

/* ---------------------------------------------------------- entrada de lote */
function modalEntrada(pre){
  pre = pre || {};
  const d6 = new Date(A.HOJE); d6.setMonth(d6.getMonth() + 6);
  A.modal("Registrar entrada de lote",
    '<div id="me-msg">' + (pre.aviso ? '<div class="okmsg">' + A.esc(pre.aviso) + "</div>" : "") + "</div>"
    + '<div class="row"><label class="lab" for="e-item">Item</label>'
    + '<select class="field" id="e-item">' + A.opcoesItens(pre.itemId) + "</select></div>"
    + '<div class="grid2"><div class="row"><label class="lab" for="e-lote">Número do lote</label>'
    + '<input class="field" id="e-lote" value="' + A.esc(pre.lote || "") + '" placeholder="ex.: CRM-25B004"></div>'
    + '<div class="row"><label class="lab" for="e-fab">Fabricante</label>'
    + '<input class="field" id="e-fab" placeholder="opcional"></div></div>'
    + '<div class="grid2"><div class="row"><label class="lab" for="e-val">Validade</label>'
    + '<input class="field" id="e-val" type="date" value="' + (pre.validade || d6.toISOString().slice(0,10)) + '"></div>'
    + '<div class="row"><label class="lab" for="e-qtd">Quantidade recebida</label>'
    + '<input class="field num" id="e-qtd" type="number" inputmode="numeric" min="1" step="1" placeholder="0"></div></div>'
    + '<div class="row"><label class="lab" for="e-nf">Nota fiscal ou documento</label>'
    + '<input class="field" id="e-nf" placeholder="opcional"></div>'
    + (pre.gtin ? '<div class="hint">Código lido: <b>' + A.esc(pre.gtin)
        + "</b>. Ao salvar, ele fica vinculado ao item e, na próxima leitura, o item vem sozinho.</div>" : ""),
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn" id="e-ok">Salvar lote</button>');

  A.$("e-ok").onclick = () => {
    const itemId = Number(A.$("e-item").value);
    const numero = A.$("e-lote").value.trim();
    const qtd    = parseInt(A.$("e-qtd").value, 10);
    if (!numero || !qtd || qtd <= 0){
      A.$("me-msg").innerHTML = '<div class="err">Informe o número do lote e uma quantidade maior que zero.</div>';
      return;
    }
    A.salvar("e-ok", "me-msg", async () => {
      const { error } = await A.sb.rpc("registrar_entrada", {
        p_item: itemId, p_numero: numero, p_qtd: qtd,
        p_validade: A.$("e-val").value || null,
        p_fabricante: A.$("e-fab").value.trim() || null,
        p_nota_fiscal: A.$("e-nf").value.trim() || null
      });
      if (error) throw error;
      if (pre.gtin) await A.sb.rpc("vincular_codigo", { p_item: itemId, p_gtin: pre.gtin });
      abertos.add(itemId);
    }, "Lote " + numero + " registrado: " + A.nfmt(qtd) + " un.");
  };
}

/* ------------------------------------------------------------- baixa FEFO */
function modalSaida(itemId){
  A.modal("Dar baixa de material",
    '<div id="ms-msg"></div>'
    + '<div class="row"><label class="lab" for="s-item">Item</label>'
    + '<select class="field" id="s-item">' + A.opcoesItens(itemId) + "</select></div>"
    + '<div class="grid2"><div class="row"><label class="lab" for="s-qtd">Quantidade</label>'
    + '<input class="field num" id="s-qtd" type="number" inputmode="numeric" min="1" step="1" placeholder="0"></div>'
    + '<div class="row"><label class="lab" for="s-local">Destino</label>'
    + '<select class="field" id="s-local">' + A.opcoesLocais() + "</select></div></div>"
    + '<div class="row"><label class="lab" for="s-nota">Observação</label>'
    + '<input class="field" id="s-nota" placeholder="opcional"></div>'
    + '<div class="row"><label class="lab">De quais lotes deve sair</label><div id="s-plano"></div></div>',
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn" id="s-ok">Confirmar baixa</button>');

  const previa = () => {
    const id = Number(A.$("s-item").value);
    const qtd = parseInt(A.$("s-qtd").value, 10) || 0;
    const lotes = A.lotesDoItem(id);
    const validos  = lotes.filter(l => A.faixa(l.validade) !== "v");
    const vencidos = lotes.filter(l => A.faixa(l.validade) === "v");
    let resta = qtd, h = '<div class="plan"><div class="ph">Prévia — o servidor confirma na hora de gravar</div>';
    if (!qtd) h += '<div class="pnone">Informe a quantidade.</div>';
    else if (!validos.length) h += '<div class="pnone">Não há lote válido com saldo para este item.</div>';
    else {
      validos.forEach(l => {
        if (resta <= 0) return;
        const usa = Math.min(resta, l.qtd_atual); resta -= usa;
        h += '<div class="pr"><span class="lnum">' + A.esc(l.numero) + "</span>"
          + '<span class="tag ' + A.faixa(l.validade) + '">' + A.brData(l.validade) + "</span>"
          + '<span class="qt num">' + A.nfmt(usa) + " un</span></div>";
      });
      if (resta > 0) h += '<div class="pr blocked"><span>Faltam <b class="num">' + A.nfmt(resta)
        + "</b> unidades nos lotes válidos</span></div>";
    }
    vencidos.forEach(l => {
      h += '<div class="pr blocked"><span class="lnum">' + A.esc(l.numero) + "</span>"
        + "<span>vencido em " + A.brData(l.validade) + ", não sai para emprego</span>"
        + '<span class="qt num">' + A.nfmt(l.qtd_atual) + " un</span></div>";
    });
    A.$("s-plano").innerHTML = h + "</div>";
  };
  A.$("s-item").onchange = previa;
  A.$("s-qtd").oninput   = previa;
  previa();

  A.$("s-ok").onclick = () => {
    const id = Number(A.$("s-item").value);
    const qtd = parseInt(A.$("s-qtd").value, 10);
    if (!qtd || qtd <= 0){
      A.$("ms-msg").innerHTML = '<div class="err">Informe uma quantidade maior que zero.</div>'; return;
    }
    let resumo = "";
    A.salvar("s-ok", "ms-msg", async () => {
      const { data, error } = await A.sb.rpc("dar_baixa", {
        p_item:id, p_qtd:qtd, p_local:Number(A.$("s-local").value),
        p_nota: A.$("s-nota").value.trim() || null
      });
      if (error) throw error;
      resumo = (data || []).map(r => r.saida_numero + " (" + A.nfmt(r.saida_qtd) + ")").join(", ");
      abertos.add(id);
    });
    setTimeout(() => { if (resumo) A.toast("Baixa de " + A.nfmt(qtd) + " un — saiu de: " + resumo); }, 60);
  };
}

/* ---------------------------------------------------------------- descarte */
function modalDescarte(loteId){
  const l = A.lotes.find(x => x.id === loteId);
  if (!l) return;
  const it = A.itens.find(x => x.id === l.item_id);
  A.modal("Registrar descarte de lote vencido",
    '<div id="md-msg"><div class="err">Lote ' + A.esc(l.numero) + " de " + A.esc(it.nome)
    + " venceu em " + A.brData(l.validade) + ". Material vencido não pode ser empregado.</div></div>"
    + '<div class="grid2"><div class="row"><label class="lab" for="d-qtd">Quantidade descartada</label>'
    + '<input class="field num" id="d-qtd" type="number" inputmode="numeric" min="1" max="' + l.qtd_atual
    + '" value="' + l.qtd_atual + '"></div>'
    + '<div class="row"><label class="lab" for="d-obs">Destinação dada</label>'
    + '<input class="field" id="d-obs" placeholder="ex.: resíduos de saúde"></div></div>'
    + '<div class="hint">O lote sai do saldo e fica no histórico. Nada é apagado.</div>',
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn danger" id="d-ok">Confirmar descarte</button>');

  A.$("d-ok").onclick = () => {
    const q = parseInt(A.$("d-qtd").value, 10);
    A.salvar("d-ok", "md-msg", async () => {
      const { error } = await A.sb.rpc("descartar_lote", {
        p_lote: loteId, p_qtd: q, p_motivo: A.$("d-obs").value.trim() || null });
      if (error) throw error;
    }, "Descarte registrado: " + A.nfmt(q) + " un.");
  };
}

/* --------------------------------------------------------------- item novo */
function modalItem(pre){
  pre = pre || {};
  const cats = Array.from(new Set(A.itens.map(i => i.categoria))).sort();
  A.modal("Cadastrar item novo",
    '<div id="mi-msg"></div>'
    + '<div class="row"><label class="lab" for="i-nome">Nome do item</label>'
    + '<input class="field" id="i-nome" placeholder="ex.: CATETER 24"></div>'
    + '<div class="grid2"><div class="row"><label class="lab" for="i-cat">Categoria</label>'
    + '<select class="field" id="i-cat">' + cats.map(c => "<option>" + A.esc(c) + "</option>").join("") + "</select></div>"
    + '<div class="row"><label class="lab" for="i-ideal">Estoque ideal</label>'
    + '<input class="field num" id="i-ideal" type="number" inputmode="numeric" min="0" value="0"></div></div>'
    + '<div class="row"><label class="lab"><input type="checkbox" id="i-val" checked> Este item tem validade</label>'
    + '<div class="hint">Marcado, toda entrada passa a exigir número de lote e data de vencimento.</div></div>',
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn" id="i-ok">Salvar item</button>');

  A.$("i-ok").onclick = () => {
    const nome = A.$("i-nome").value.trim().toUpperCase();
    if (!nome){ A.$("mi-msg").innerHTML = '<div class="err">Informe o nome do item.</div>'; return; }
    let novo = null;
    A.salvar("i-ok", "mi-msg", async () => {
      const { data, error } = await A.sb.from("itens").insert({
        nome, categoria: A.$("i-cat").value,
        estoque_ideal: parseInt(A.$("i-ideal").value, 10) || 0,
        controla_validade: A.$("i-val").checked,
        gtin: pre.gtin || null
      }).select().single();
      if (error) throw error;
      novo = data;
    }, "Item " + nome + " cadastrado.");
    setTimeout(() => { if (novo) modalEntrada({ itemId:novo.id, aviso:"Item criado. Registre agora o primeiro lote." }); }, 500);
  };
}

/* --------------------------------------------------------------- histórico */
async function modalHistorico(){
  A.modal("Histórico de movimentação", '<div class="skel">Carregando…</div>',
    '<button class="btn sec" onclick="A.fecharModal()">Fechar</button>');
  const { data, error } = await A.sb.from("movimentos")
    .select("*, itens(nome), locais(nome), perfis(nome_guerra)")
    .order("em", { ascending:false }).limit(200);
  const corpo = document.querySelector(".mbody");
  if (!corpo) return;
  if (error){ corpo.innerHTML = '<div class="err">' + A.esc(A.explicar(error)) + "</div>"; return; }
  if (!data.length){
    corpo.innerHTML = '<div class="empty"><b>Nenhuma movimentação ainda.</b>'
      + "Registre uma entrada ou uma baixa para começar o histórico.</div>";
    return;
  }
  corpo.innerHTML = '<div class="mvlist" style="margin:-18px -20px">' + data.map(m =>
    '<div class="mv"><span class="d num">' + new Date(m.em).toLocaleDateString("pt-BR") + "</span>"
    + '<span class="k ' + m.tipo + '">' + m.tipo + "</span>"
    + "<span><b>" + A.esc(m.itens ? m.itens.nome : "—") + "</b> — " + A.nfmt(m.qtd) + " un"
    + (m.locais ? " para " + A.esc(m.locais.nome) : "")
    + "<div style='color:var(--muted);font-size:11.5px'>" + A.esc(m.nota || "")
    + (m.perfis ? " · " + A.esc(m.perfis.nome_guerra) : "") + "</div></span></div>").join("") + "</div>";
}

/* ------------------------------------------------------------------- foto */
function escolherFoto(itemId){
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "image/*"; inp.capture = "environment";
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    A.toast("Enviando foto…");
    try {
      const blob = await reduzir(f, 900);
      const path = itemId + ".jpg";
      const up = await A.sb.storage.from("fotos-itens")
        .upload(path, blob, { upsert:true, contentType:"image/jpeg" });
      if (up.error) throw up.error;
      const { error } = await A.sb.rpc("definir_foto", { p_item:itemId, p_path:path });
      if (error) throw error;
      A.toast("Foto salva.");
      await A.recarregar();
    } catch(e){ A.toast(A.explicar(e), true); }
  };
  inp.click();
}

/** Reduz a imagem antes de subir: a rede do quartel agradece. */
function reduzir(file, max){
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => {
      const e = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * e); c.height = Math.round(img.height * e);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => b ? ok(b) : falha(new Error("Não deu para processar a imagem.")), "image/jpeg", 0.82);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => falha(new Error("Arquivo de imagem inválido."));
    img.src = URL.createObjectURL(file);
  });
}

/* ================================================== CÓDIGO DE BARRAS GS1
   Caixa de material de saúde costuma trazer GS1 DataMatrix, que carrega
   produto, lote e validade na mesma etiqueta. Lendo, some a digitação.
   ===================================================================== */
const AI_FIXO = { "00":18, "01":14, "02":14, "11":6, "12":6, "13":6, "15":6, "16":6, "17":6, "20":2 };

function lerGS1(txt){
  // O identificador de simbologia tem exatamente 3 caracteres (]d2, ]C1, ]Q3).
  const s = String(txt).replace(/^\][A-Za-z][0-9]/, "");
  const out = {}; let i = 0;
  while (i < s.length - 1){
    const ai = s.slice(i, i + 2); i += 2;
    const fixo = AI_FIXO[ai];
    let val;
    if (fixo){ val = s.slice(i, i + fixo); i += fixo; }
    else {
      const fim = s.indexOf("\u001d", i);
      val = fim === -1 ? s.slice(i) : s.slice(i, fim);
      i = fim === -1 ? s.length : fim + 1;
    }
    if (ai === "01") out.gtin = val.replace(/^0+/, "");
    if (ai === "10") out.lote = val;
    if (ai === "17") out.validade = dataGS1(val);
    if (ai === "11") out.fabricacao = dataGS1(val);
    if (!AI_FIXO[ai] && ai !== "10" && ai !== "21") break;
  }
  return out;
}
function dataGS1(aammdd){
  if (!/^\d{6}$/.test(aammdd)) return null;
  const aa = +aammdd.slice(0,2), mm = aammdd.slice(2,4);
  let dd = aammdd.slice(4,6);
  const ano = 2000 + aa;
  if (dd === "00") dd = String(new Date(ano, +mm, 0).getDate()).padStart(2,"0");
  return ano + "-" + mm + "-" + dd;
}
A.lerGS1 = lerGS1; A.dataGS1 = dataGS1;   // expostos para teste

let fluxo = null;
async function abrirLeitor(){
  if (!("BarcodeDetector" in window)){
    A.toast("Este navegador não lê código de barras. Use o Chrome no Android, ou digite os dados.", true);
    return modalEntrada({});
  }
  let det;
  try {
    det = new window.BarcodeDetector({ formats:["data_matrix","code_128","qr_code","ean_13","ean_8","code_39"] });
  } catch(e){ A.toast("Leitor indisponível neste aparelho.", true); return modalEntrada({}); }

  A.$("scanner").innerHTML = '<div class="scanwrap"><video id="sc-video" playsinline muted></video>'
    + '<div class="scanmira"></div><div class="scanbar">'
    + '<span class="msg">Aponte para o código da caixa</span>'
    + '<button class="btn sec" id="sc-fechar">Fechar</button>'
    + '<button class="btn sec" id="sc-manual">Digitar</button></div></div>';
  A.$("sc-fechar").onclick = fecharLeitor;
  A.$("sc-manual").onclick = () => { fecharLeitor(); modalEntrada({}); };

  try {
    fluxo = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:"environment" } } });
  } catch(e){
    fecharLeitor();
    A.toast("Sem acesso à câmera. Libere a permissão no navegador.", true);
    return modalEntrada({});
  }
  const v = A.$("sc-video");
  v.srcObject = fluxo;
  await v.play().catch(() => {});

  const tentar = async () => {
    if (!fluxo) return;
    try {
      const cods = await det.detect(v);
      if (cods.length){
        const g = lerGS1(cods[0].rawValue);
        fecharLeitor();
        return usarLeitura(g, cods[0].rawValue);
      }
    } catch(e){ /* quadro ruim, tenta o próximo */ }
    requestAnimationFrame(tentar);
  };
  requestAnimationFrame(tentar);
}

function fecharLeitor(){
  if (fluxo){ fluxo.getTracks().forEach(t => t.stop()); fluxo = null; }
  A.$("scanner").innerHTML = "";
}

function usarLeitura(g, cru){
  const gtin = g.gtin || (/^\d{8,14}$/.test(cru) ? cru.replace(/^0+/, "") : null);
  const achado = gtin ? A.itens.find(i => i.gtin && i.gtin.replace(/^0+/, "") === gtin) : null;
  if (achado){
    return modalEntrada({
      itemId: achado.id, lote: g.lote || "", validade: g.validade || null,
      aviso: "Código reconhecido: " + achado.nome + (g.lote ? ". Lote e validade vieram da etiqueta." : ".")
    });
  }
  if (!gtin && !g.lote){
    A.toast("Código lido, mas sem informação aproveitável. Digite os dados.", true);
    return modalEntrada({});
  }
  modalEntrada({
    gtin, lote: g.lote || "", validade: g.validade || null,
    aviso: "Código ainda não cadastrado. Escolha o item e ele fica vinculado para as próximas leituras."
  });
}

/* --------------------------------------------------------------------- CSV */
function baixarCSV(){
  const L = [["ITEM","CATEGORIA","LOTE","FABRICANTE","VALIDADE","SITUACAO","SALDO_LOTE",
              "QTD_INICIAL","ENTRADA","NOTA_FISCAL","ESTOQUE_IDEAL","SALDO_PLANILHA_ANTIGA"]];
  A.itens.forEach(it => {
    const lotes = A.lotesDoItem(it.id);
    if (!lotes.length) L.push([it.nome, it.categoria,"","","","SEM LOTE","","","","",it.estoque_ideal,it.saldo_legado]);
    else lotes.forEach(l => L.push([it.nome, it.categoria, l.numero, l.fabricante || "",
      A.brData(l.validade), A.ROTULO[A.faixa(l.validade)], l.qtd_atual, l.qtd_inicial,
      A.brData(l.data_entrada), l.nota_fiscal || "", it.estoque_ideal, it.saldo_legado]));
  });
  const csv = "\uFEFF" + L.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" }));
  a.download = "estoque-smo-" + A.hojeISO() + ".csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------------------------------------------------------- registro */
A.estoque = { modalEntrada, modalSaida, modalItem };
A.registrarAba("estoque", "Estoque", render, () => {
  const venc = A.lotes.filter(l => A.faixa(l.validade) === "v").length;
  return { qtd: venc, urgente: true };
});
})();
