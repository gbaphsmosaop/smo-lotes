/* =====================================================================
   PAINEL DE DECISÃO
   Não é um mural de números bonitos: cada cartão responde a uma pergunta
   que gera ação, e clicar leva direto à lista que resolve aquilo.
   Tudo sai de uma chamada só — painel_resumo() no banco.
   ===================================================================== */
"use strict";

(() => {
const PERIODOS = [[30,"30 dias"],[90,"90 dias"],[180,"6 meses"],[365,"1 ano"]];
const C = () => A.graf.CORES;

const mesBR = ym => {
  const M = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const p = String(ym).split("-");
  return M[+p[1] - 1] + "/" + p[0].slice(2);
};

/* ----------------------------------------------------------------- render */
function render(sec){
  const r = A.resumo;
  if (!r){
    sec.innerHTML = '<div class="panel"><div class="empty">'
      + "<b>Painel ainda não disponível.</b>"
      + "Rode <b>sql/03-modulos.sql</b> no SQL Editor do Supabase para criar as visões "
      + "de consumo, equipamentos e pedidos que alimentam este painel.</div></div>"
      + '<div class="panel"><div class="phead"><h2>Enquanto isso</h2></div>'
      + '<div class="pbody" style="font-size:13px;color:var(--ink-2)">'
      + "O módulo de estoque funciona normalmente. Use a aba <b>Estoque</b>.</div></div>";
    return;
  }

  sec.innerHTML =
    '<div class="bar"><h2 style="font-size:20px;margin-right:6px">O que precisa da sua atenção</h2>'
    + '<span class="sep"></span>'
    + "<span style='font-size:12.5px;color:var(--muted)'>consumo dos últimos</span>"
    + '<select class="field auto" id="pa-per" style="min-width:120px">'
    + PERIODOS.map(([v,t]) => '<option value="' + v + '"'
        + (v === A.periodo ? " selected" : "") + ">" + t + "</option>").join("")
    + "</select></div>"
    + '<div class="cards" id="pa-cards"></div>'
    + '<div class="grafgrid" id="pa-graficos"></div>'
    + '<div class="panel"><div class="phead"><h2>Prioridade de reposição</h2>'
    + '<span class="cnt">o que falta para o ideal, e quanto tempo o saldo aguenta no ritmo atual</span>'
    + '<div class="dir"><button class="btn sm sec" id="pa-csv">CSV</button></div></div>'
    + '<div id="pa-repo"></div></div>';

  desenharCards(r);
  desenharGraficos(r);
  desenharReposicao(r);

  A.$("pa-per").onchange = async e => {
    A.periodo = Number(e.target.value);
    A.$("pa-graficos").innerHTML = '<div class="skel">Recalculando…</div>';
    await A.recarregar();
  };
  A.$("pa-csv").onclick = () => baixarCSV(r);
}

/* --------------------------------------------------------------- cartões */
function desenharCards(r){
  const v = r.validade || {}, e = r.estoque || {}, q = r.equipamentos || {}, p = r.pedidos || {};
  const zerando = (r.reposicao || []).filter(x => x.dias_ate_zerar !== null && x.dias_ate_zerar <= 30).length;

  const cards = [
    { c:"v", n:v.vencidos || 0, t:"lotes vencidos",
      u:A.nfmt(v.un_vencidas || 0) + " unidades presas no estoque",
      ir:["estoque", { filtro:"vencido" }] },
    { c:"a", n:v.ate30 || 0, t:"vencem em até 30 dias",
      u:"empregar antes de virar descarte", ir:["estoque", { filtro:"d30" }] },
    { c:"n", n:zerando, t:"zeram em menos de 30 dias",
      u:"pelo ritmo de consumo atual", ir:["estoque", { filtro:"critico" }] },
    { c:"b", n:e.abaixo_ideal || 0, t:"itens abaixo do estoque ideal",
      u:"base para o próximo pedido", ir:["estoque", { filtro:"critico" }] },
    { c:"a", n:(q.manutencao || 0) + (q.inspecao_vencida || 0), t:"equipamentos a resolver",
      u:(q.manutencao || 0) + " em manutenção, " + (q.inspecao_vencida || 0) + " com inspeção vencida",
      ir:["equipamentos", { situacao:"manutencao" }] },
    { c:"o", n:p.abertos || 0, t:"pedidos em andamento",
      u:(p.atrasados || 0) + " passaram da previsão", ir:["pedidos", { situacao:"abertos" }] },
    { c:"s", n:r.missoes_hoje || 0, t:"missões lançadas para hoje",
      u:"escala da seção", ir:["missoes", {}] },
    { c:"s", n:e.sem_lote || 0, t:"itens sem lote cadastrado",
      u:"fila de migração da planilha", ir:["estoque", { filtro:"semlote" }] }
  ];

  A.$("pa-cards").innerHTML = cards.map((c,i) =>
    '<button class="card ' + c.c + '" data-i="' + i + '"><div class="n num">' + c.n + "</div>"
    + '<div class="t">' + A.esc(c.t) + '</div><div class="u">' + A.esc(c.u) + "</div></button>").join("");
  A.$("pa-cards").querySelectorAll("[data-i]").forEach(b =>
    b.onclick = () => { const c = cards[+b.dataset.i]; A.irPara(c.ir[0], c.ir[1]); });
}

/* --------------------------------------------------------------- gráficos */
function desenharGraficos(r){
  const cor = C();
  const per = (PERIODOS.find(p => p[0] === A.periodo) || [0,""])[1];
  let h = "";

  // 1. consumo por item
  h += A.graf.caixa("Itens mais consumidos", "saídas nos últimos " + per,
    A.graf.barrasH((r.top_consumo || []).map(t => ({ rotulo:t.nome, valor:t.qtd })),
      { cor: cor.navy, titulo:"Itens mais consumidos" }));

  // 2. consumo por destino
  h += A.graf.caixa("Para onde o material foi", "saídas por destino nos últimos " + per,
    A.graf.barrasH((r.por_destino || []).map(t => ({ rotulo:t.nome, valor:t.qtd })),
      { cor: cor.gold, titulo:"Consumo por destino", larguraRotulo:200 }));

  // 3. entradas x saídas por mês
  const meses = r.por_mes || [];
  h += A.graf.caixa("Entradas e saídas por mês", "volume de movimentação",
    A.graf.barrasV(
      meses.map(m => ({ rotulo: mesBR(m.mes), valores: [m.entradas || 0, m.saidas || 0] })),
      [{ nome:"Entradas", cor: cor.ok }, { nome:"Saídas", cor: cor.navy }],
      { titulo:"Movimentação mensal" }),
    A.graf.legenda([{ nome:"Entradas", cor: cor.ok }, { nome:"Saídas", cor: cor.navy }]));

  // 4. disponibilidade de equipamento por categoria
  const q = r.equipamentos || {};
  const cats = (r.equip_por_categoria || []).map(c => ({
    rotulo: c.categoria,
    partes: [
      { nome:"Disponível",   valor: c.disponivel,             cor: cor.ok },
      { nome:"Indisponível", valor: c.total - c.disponivel,   cor: cor.venc }
    ]
  }));
  h += A.graf.caixa("Disponibilidade dos equipamentos", "prontos para emprego x parados",
    A.graf.empilhada(cats, { titulo:"Disponibilidade por categoria" }),
    A.graf.legenda([{ nome:"Disponível", cor: cor.ok }, { nome:"Em manutenção ou baixado", cor: cor.venc }]));

  // 5. rosca da frota
  const total = q.total || 0;
  const disp = (q.operacional || 0) + (q.reserva || 0);
  h += A.graf.caixa("Frota em condição de uso", "de todo o patrimônio cadastrado",
    '<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">'
    + '<div style="width:190px;flex:none">'
    + A.graf.rosca([
        { nome:"Operacional", valor:q.operacional || 0, cor: cor.ok },
        { nome:"Reserva",     valor:q.reserva || 0,     cor: cor.d90 },
        { nome:"Manutenção",  valor:q.manutencao || 0,  cor: cor.d30 },
        { nome:"Baixado",     valor:q.baixado || 0,     cor: cor.venc }
      ], { centro: total ? Math.round(disp / total * 100) + "%" : "—",
           centroSub: disp + " de " + total, titulo:"Situação da frota" })
    + "</div><div style='flex:1;min-width:150px;font-size:12.5px'>"
    + [["Operacional", q.operacional || 0, cor.ok], ["Reserva", q.reserva || 0, cor.d90],
       ["Em manutenção", q.manutencao || 0, cor.d30], ["Baixado", q.baixado || 0, cor.venc]]
      .map(([n,v,c]) => "<div style='display:flex;align-items:center;gap:8px;padding:3px 0'>"
        + "<i style='width:10px;height:10px;border-radius:2px;background:" + c + ";display:inline-block'></i>"
        + "<span style='flex:1'>" + n + "</span><b class='num'>" + v + "</b></div>").join("")
    + "</div></div>");

  A.$("pa-graficos").innerHTML = h;
}

/* -------------------------------------------------- prioridade de reposição */
function desenharReposicao(r){
  const lista = r.reposicao || [];
  if (!lista.length){
    A.$("pa-repo").innerHTML = '<div class="empty"><b>Nada abaixo do ideal no momento.</b>'
      + "Quando algum item cair, ele aparece aqui ordenado pela urgência.</div>";
    return;
  }
  let h = "<table><thead><tr><th>Item</th><th class='r'>Saldo</th><th class='r'>Ideal</th>"
    + "<th class='r'>Falta</th><th class='r'>Consumo/dia</th><th>Zera em</th><th>Urgência</th>"
    + "</tr></thead><tbody>";
  lista.forEach(x => {
    const d = x.dias_ate_zerar;
    const cls = d === null ? "s" : d <= 15 ? "v" : d <= 30 ? "a" : d <= 60 ? "b" : "o";
    const rot = d === null ? "sem consumo" : d <= 15 ? "Imediata" : d <= 30 ? "Alta"
              : d <= 60 ? "Média" : "Baixa";
    h += "<tr><td><div class='iname'>" + A.esc(x.nome) + "</div>"
      + "<div class='icat'>" + A.esc(x.categoria) + "</div></td>"
      + "<td class='r num' data-rot='Saldo'><b>" + A.nfmt(x.saldo) + "</b></td>"
      + "<td class='r num' data-rot='Ideal' style='color:var(--muted)'>" + A.nfmt(x.estoque_ideal) + "</td>"
      + "<td class='r num' data-rot='Falta' style='" + (x.falta_para_ideal > 0
          ? "color:var(--d30);font-weight:600" : "color:var(--muted)") + "'>"
      + A.nfmt(x.falta_para_ideal) + "</td>"
      + "<td class='r num' data-rot='Consumo/dia' style='color:var(--muted)'>"
      + (x.consumo_dia > 0 ? Number(x.consumo_dia).toLocaleString("pt-BR") : "—") + "</td>"
      + "<td data-rot='Zera em'>" + (d === null ? "<span style='color:var(--muted)'>—</span>"
          : "<b class='num'>" + A.nfmt(d) + "</b> dias") + "</td>"
      + '<td><span class="tag ' + cls + '">' + rot + "</span></td></tr>";
  });
  A.$("pa-repo").innerHTML = h + "</tbody></table>";
}

/* --------------------------------------------------------------------- CSV */
function baixarCSV(r){
  const L = [["ITEM","CATEGORIA","SALDO","ESTOQUE_IDEAL","FALTA","CONSUMO_DIA","DIAS_ATE_ZERAR"]];
  (r.reposicao || []).forEach(x => L.push([x.nome, x.categoria, x.saldo, x.estoque_ideal,
    x.falta_para_ideal, x.consumo_dia, x.dias_ate_zerar === null ? "" : x.dias_ate_zerar]));
  const csv = "\uFEFF" + L.map(f => f.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" }));
  a.download = "prioridade-reposicao-" + A.hojeISO() + ".csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------------------------------------------------------- registro
   Registrado por último no HTML, mas movido para o começo da barra:
   é a primeira tela que o militar vê ao entrar.                            */
A.abas.unshift({ id:"painel", rotulo:"Painel", render, contador: () => null });
})();
