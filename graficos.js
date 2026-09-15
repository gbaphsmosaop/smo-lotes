/* =====================================================================
   GRÁFICOS — SVG desenhado à mão.
   Sem biblioteca externa de propósito: nada para quebrar quando uma CDN
   sair do ar, e o traço casa com o resto da identidade.
   Todos devolvem string de SVG para injetar direto no HTML.
   ===================================================================== */
"use strict";

A.graf = {};

const CORES = {
  navy:"#2B4372", navy2:"#4A6399", gold:"#C8A25C",
  venc:"#9B1B23", d30:"#C25E12", d90:"#A98A22", ok:"#1F6B45",
  linha:"#E4E9F0", texto:"#6B7688", tinta:"#3C4655"
};
A.graf.CORES = CORES;

const corta = (s, n) => {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
};
const vazio = msg => '<div class="gvazio">' + A.esc(msg) + "</div>";

/* ---------------------------------------------------------------------
   Barras horizontais — para ranking (consumo por item, por destino).
   dados: [{rotulo, valor, cor?}]
   --------------------------------------------------------------------- */
A.graf.barrasH = (dados, opts) => {
  opts = opts || {};
  if (!dados || !dados.length) return vazio(opts.vazio || "Sem movimentação no período.");

  const L = 560, rotL = opts.larguraRotulo || 186, dir = 58;
  const alt = 25, gap = 6;
  const A_ = dados.length * (alt + gap) + 6;
  const max = Math.max(...dados.map(d => d.valor), 1);
  const util = L - rotL - dir;

  let s = '<svg viewBox="0 0 ' + L + " " + A_ + '" role="img" aria-label="'
        + A.esc(opts.titulo || "Gráfico de barras") + '">';
  dados.forEach((d, i) => {
    const y = i * (alt + gap);
    const w = Math.max((d.valor / max) * util, d.valor > 0 ? 2 : 0);
    const cor = d.cor || opts.cor || CORES.navy;
    s += '<text x="0" y="' + (y + alt/2 + 4) + '" font-size="12" fill="' + CORES.tinta + '">'
       + A.esc(corta(d.rotulo, 30)) + "</text>"
       + '<rect x="' + rotL + '" y="' + y + '" width="' + w + '" height="' + alt
       + '" rx="2" fill="' + cor + '"/>'
       + '<text x="' + (rotL + w + 7) + '" y="' + (y + alt/2 + 4)
       + '" font-size="12" font-weight="600" fill="' + CORES.tinta + '"'
       + ' style="font-variant-numeric:tabular-nums">' + A.nfmt(d.valor) + "</text>";
  });
  return s + "</svg>";
};

/* ---------------------------------------------------------------------
   Barras verticais agrupadas — entradas x saídas por mês.
   grupos: [{rotulo, valores:[a,b]}]  series: [{nome, cor}]
   --------------------------------------------------------------------- */
A.graf.barrasV = (grupos, series, opts) => {
  opts = opts || {};
  if (!grupos || !grupos.length) return vazio(opts.vazio || "Sem movimentação no período.");

  const L = 560, A_ = 220, esq = 46, baixo = 30, topo = 12;
  const util = L - esq - 8, altU = A_ - baixo - topo;
  const max = Math.max(...grupos.flatMap(g => g.valores), 1);
  const passo = util / grupos.length;
  const larg = Math.min((passo - 10) / series.length, 26);

  // escala arredondada para cima
  const grau = Math.pow(10, Math.floor(Math.log10(max)));
  const teto = Math.ceil(max / grau) * grau;
  const y = v => topo + altU - (v / teto) * altU;

  let s = '<svg viewBox="0 0 ' + L + " " + A_ + '" role="img" aria-label="'
        + A.esc(opts.titulo || "Gráfico de colunas") + '">';

  // linhas de referência
  [0, 0.25, 0.5, 0.75, 1].forEach(f => {
    const yy = y(teto * f);
    s += '<line x1="' + esq + '" y1="' + yy + '" x2="' + L + '" y2="' + yy
       + '" stroke="' + CORES.linha + '" stroke-width="1"/>'
       + '<text x="' + (esq - 7) + '" y="' + (yy + 4) + '" font-size="10" text-anchor="end" fill="'
       + CORES.texto + '" style="font-variant-numeric:tabular-nums">'
       + A.nfmt(Math.round(teto * f)) + "</text>";
  });

  grupos.forEach((g, i) => {
    const x0 = esq + i * passo + (passo - larg * series.length) / 2;
    g.valores.forEach((v, j) => {
      const yy = y(v), h = Math.max(topo + altU - yy, v > 0 ? 2 : 0);
      s += '<rect x="' + (x0 + j * larg) + '" y="' + yy + '" width="' + (larg - 3)
         + '" height="' + h + '" rx="2" fill="' + series[j].cor + '"><title>'
         + A.esc(g.rotulo + " · " + series[j].nome + ": " + A.nfmt(v)) + "</title></rect>";
    });
    s += '<text x="' + (esq + i * passo + passo/2) + '" y="' + (A_ - 10)
       + '" font-size="10.5" text-anchor="middle" fill="' + CORES.texto + '">'
       + A.esc(g.rotulo) + "</text>";
  });
  return s + "</svg>";
};

/* ---------------------------------------------------------------------
   Barras empilhadas horizontais — disponibilidade por categoria.
   dados: [{rotulo, partes:[{valor, cor, nome}]}]
   --------------------------------------------------------------------- */
A.graf.empilhada = (dados, opts) => {
  opts = opts || {};
  if (!dados || !dados.length) return vazio(opts.vazio || "Sem equipamento cadastrado.");

  const L = 560, rotL = 164, dir = 44, alt = 23, gap = 8;
  const A_ = dados.length * (alt + gap) + 4;
  const max = Math.max(...dados.map(d => d.partes.reduce((s,p) => s + p.valor, 0)), 1);
  const util = L - rotL - dir;

  let s = '<svg viewBox="0 0 ' + L + " " + A_ + '" role="img" aria-label="'
        + A.esc(opts.titulo || "Gráfico empilhado") + '">';
  dados.forEach((d, i) => {
    const y = i * (alt + gap);
    const total = d.partes.reduce((a,p) => a + p.valor, 0);
    let x = rotL;
    s += '<text x="0" y="' + (y + alt/2 + 4) + '" font-size="12" fill="' + CORES.tinta + '">'
       + A.esc(corta(d.rotulo, 24)) + "</text>";
    d.partes.forEach(p => {
      if (p.valor <= 0) return;
      const w = (p.valor / max) * util;
      s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + alt
         + '" fill="' + p.cor + '"><title>' + A.esc(p.nome + ": " + p.valor) + "</title></rect>";
      if (w > 22){
        s += '<text x="' + (x + w/2) + '" y="' + (y + alt/2 + 4) + '" font-size="11" font-weight="600"'
           + ' text-anchor="middle" fill="#fff" style="font-variant-numeric:tabular-nums">'
           + p.valor + "</text>";
      }
      x += w;
    });
    s += '<text x="' + (x + 7) + '" y="' + (y + alt/2 + 4) + '" font-size="11.5" fill="'
       + CORES.texto + '" style="font-variant-numeric:tabular-nums">' + total + "</text>";
  });
  return s + "</svg>";
};

/* ---------------------------------------------------------------------
   Rosca — proporção simples, com o número grande no meio.
   partes: [{nome, valor, cor}]
   --------------------------------------------------------------------- */
A.graf.rosca = (partes, opts) => {
  opts = opts || {};
  const total = partes.reduce((s,p) => s + p.valor, 0);
  if (!total) return vazio(opts.vazio || "Sem dados.");

  const T = 190, c = T/2, rExt = 82, rInt = 54;
  let ang = -Math.PI / 2, s = '<svg viewBox="0 0 ' + T + " " + T + '" role="img" aria-label="'
    + A.esc(opts.titulo || "Gráfico de rosca") + '">';

  partes.forEach(p => {
    if (p.valor <= 0) return;
    const fatia = (p.valor / total) * Math.PI * 2;
    const fim = ang + fatia;
    const grande = fatia > Math.PI ? 1 : 0;
    const x1 = c + rExt*Math.cos(ang),  y1 = c + rExt*Math.sin(ang);
    const x2 = c + rExt*Math.cos(fim),  y2 = c + rExt*Math.sin(fim);
    const x3 = c + rInt*Math.cos(fim),  y3 = c + rInt*Math.sin(fim);
    const x4 = c + rInt*Math.cos(ang),  y4 = c + rInt*Math.sin(ang);
    // fatia única fecha o anel inteiro: dois arcos evitam o bug do 360°
    const d = partes.filter(q => q.valor > 0).length === 1
      ? "M " + (c-rExt) + " " + c + " A " + rExt + " " + rExt + " 0 1 1 " + (c+rExt) + " " + c
        + " A " + rExt + " " + rExt + " 0 1 1 " + (c-rExt) + " " + c + " Z"
        + " M " + (c-rInt) + " " + c + " A " + rInt + " " + rInt + " 0 1 0 " + (c+rInt) + " " + c
        + " A " + rInt + " " + rInt + " 0 1 0 " + (c-rInt) + " " + c + " Z"
      : "M " + x1 + " " + y1 + " A " + rExt + " " + rExt + " 0 " + grande + " 1 " + x2 + " " + y2
        + " L " + x3 + " " + y3 + " A " + rInt + " " + rInt + " 0 " + grande + " 0 " + x4 + " " + y4 + " Z";
    s += '<path d="' + d + '" fill="' + p.cor + '" fill-rule="evenodd"><title>'
       + A.esc(p.nome + ": " + p.valor + " (" + Math.round(p.valor/total*100) + "%)") + "</title></path>";
    ang = fim;
  });

  s += '<text x="' + c + '" y="' + (c - 2) + '" text-anchor="middle" font-size="32"'
     + ' font-family="Bebas Neue, Impact, sans-serif" fill="' + CORES.tinta + '">'
     + A.esc(opts.centro !== undefined ? opts.centro : total) + "</text>";
  if (opts.centroSub){
    s += '<text x="' + c + '" y="' + (c + 16) + '" text-anchor="middle" font-size="10.5" fill="'
       + CORES.texto + '">' + A.esc(opts.centroSub) + "</text>";
  }
  return s + "</svg>";
};

/* --------------------------------------------------------------- legenda */
A.graf.legenda = itens => '<div class="gleg">' + itens.map(i =>
  '<span><i style="background:' + i.cor + '"></i>' + A.esc(i.nome) + "</span>").join("") + "</div>";

/* ----------------------------------------------- caixa padrão de gráfico */
A.graf.caixa = (titulo, sub, conteudo, legenda) =>
  '<div class="grafbox"><h3>' + A.esc(titulo) + "</h3>"
  + (sub ? '<p class="sub">' + A.esc(sub) + "</p>" : "")
  + conteudo + (legenda || "") + "</div>";

/* ------------------------------------------------------ barra de progresso */
A.graf.progresso = (pct, rotulo) => {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return '<div class="progwrap"><div class="prog"><i class="' + (p >= 100 ? "cheio" : "")
    + '" style="width:' + p + '%"></i></div><span class="pc num">'
    + (rotulo !== undefined ? A.esc(rotulo) : p + "%") + "</span></div>";
};
