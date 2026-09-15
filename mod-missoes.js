/* =====================================================================
   MÓDULO MISSÕES DO DIA
   A aba que a tropa abre de manhã: o que a seção tem para fazer hoje,
   em que turno, com quem, e o que já foi concluído.
   ===================================================================== */
"use strict";

(() => {
let dia = null;                    // ISO da data selecionada
let MISSOES = [], EQUIPES = {};

const PRIOR = { rotina:"Rotina", prioritaria:"Prioritária", urgente:"Urgente" };
const SIT   = { prevista:"Prevista", em_andamento:"Em andamento",
                concluida:"Concluída", cancelada:"Cancelada" };
const TURNOS = ["manhã","tarde","noite","24h"];
const ORDEM_P = { urgente:0, prioritaria:1, rotina:2 };
const ORDEM_T = { "manhã":0, tarde:1, noite:2, "24h":3 };

const DIASEM = ["dom","seg","ter","qua","qui","sex","sáb"];

function isoMais(n){
  const d = new Date(A.HOJE);
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0")
       + "-" + String(d.getDate()).padStart(2,"0");
}

async function carregar(){
  const de  = isoMais(-3), ate = isoMais(14);
  const [m, e] = await Promise.all([
    A.sb.from("missoes").select("*, locais(nome), perfis(nome_guerra)")
      .gte("data", de).lte("data", ate).order("data"),
    A.sb.from("missao_militares").select("*, perfis(id,nome_guerra)")
  ]);
  if (m.error) return false;
  MISSOES = m.data || [];
  EQUIPES = {};
  (e.data || []).forEach(x => {
    (EQUIPES[x.missao_id] = EQUIPES[x.missao_id] || []).push(x.perfis);
  });
  return true;
}

const doDia = d => MISSOES.filter(m => String(m.data).slice(0,10) === d)
  .sort((a,b) => (ORDEM_T[a.turno] - ORDEM_T[b.turno]) || (ORDEM_P[a.prioridade] - ORDEM_P[b.prioridade]));

/* ----------------------------------------------------------------- render */
async function render(sec){
  if (!dia) dia = isoMais(0);
  sec.innerHTML = '<div class="skel">Carregando missões…</div>';
  const ok = await carregar();
  if (!ok){
    sec.innerHTML = '<div class="panel"><div class="empty"><b>Módulo de missões não instalado.</b>'
      + "Rode <b>sql/03-modulos.sql</b> no SQL Editor do Supabase.</div></div>";
    return;
  }
  const pode = A.pode();
  sec.innerHTML = '<div class="dias" id="ms-dias"></div>'
    + '<div class="bar"><button class="btn" id="ms-nova"' + (pode ? "" : " disabled")
    + ">Nova missão</button>"
    + "<span style='font-size:12.5px;color:var(--muted)' id='ms-res'></span></div>"
    + '<div id="ms-lista"></div>';

  desenharDias();
  desenharLista();
  A.$("ms-nova").onclick = () => modalMissao();
}

function desenharDias(){
  let h = "";
  for (let i = -1; i <= 7; i++){
    const d = isoMais(i);
    const dt = new Date(d + "T12:00:00");
    const qt = doDia(d).filter(m => m.situacao !== "cancelada").length;
    const rot = i === 0 ? "hoje" : i === 1 ? "amanhã" : i === -1 ? "ontem" : DIASEM[dt.getDay()];
    h += "<button data-d='" + d + "'" + (d === dia ? " aria-current='true'" : "") + ">"
      + rot + "<b>" + String(dt.getDate()).padStart(2,"0") + "/"
      + String(dt.getMonth()+1).padStart(2,"0") + "</b>"
      + "<span class='qt'>" + (qt ? qt + (qt === 1 ? " missão" : " missões") : "livre") + "</span></button>";
  }
  A.$("ms-dias").innerHTML = h;
  A.$("ms-dias").querySelectorAll("[data-d]").forEach(b =>
    b.onclick = () => { dia = b.dataset.d; desenharDias(); desenharLista(); });
}

function desenharLista(){
  const lista = doDia(dia);
  const feitas = lista.filter(m => m.situacao === "concluida").length;
  A.$("ms-res").textContent = lista.length
    ? feitas + " de " + lista.length + " concluídas" : "";

  if (!lista.length){
    A.$("ms-lista").innerHTML = '<div class="panel"><div class="empty">'
      + "<b>Nenhuma missão lançada para " + A.brData(dia) + ".</b>"
      + (A.pode() ? "Use o botão acima para lançar a primeira." : "") + "</div></div>";
    return;
  }

  let turnoAtual = null, h = "";
  lista.forEach(m => {
    if (m.turno !== turnoAtual){
      turnoAtual = m.turno;
      h += "<h2 style='font-size:17px;margin:16px 0 9px;color:var(--ink-2)'>"
        + turnoAtual.toUpperCase() + "</h2>";
    }
    const equipe = EQUIPES[m.id] || [];
    const feita = ["concluida","cancelada"].includes(m.situacao);
    h += '<div class="missao ' + m.prioridade + (feita ? " feita" : "") + '">'
      + '<div class="ttl">' + A.esc(m.titulo)
      + '<span class="tag ' + m.situacao + '">' + SIT[m.situacao] + "</span>"
      + (m.prioridade !== "rotina"
          ? '<span class="tag ' + m.prioridade + '">' + PRIOR[m.prioridade] + "</span>" : "")
      + "</div>"
      + '<div class="meta">' + (m.locais ? A.esc(m.locais.nome) + " · " : "")
      + "lançada por " + A.esc(m.perfis ? m.perfis.nome_guerra : "—") + "</div>"
      + (m.descricao ? '<div class="desc">' + A.esc(m.descricao) + "</div>" : "")
      + (equipe.length
          ? '<div class="equipe">' + equipe.map(p =>
              '<span class="mil">' + A.esc(p ? p.nome_guerra : "—") + "</span>").join("") + "</div>"
          : "<div class='meta' style='margin-top:8px'>Sem militar designado</div>")
      + (A.pode() ? '<div class="fim">'
          + (m.situacao === "prevista"
              ? "<button class='btn sm' data-and='" + m.id + "'>Iniciar</button>" : "")
          + (["prevista","em_andamento"].includes(m.situacao)
              ? "<button class='btn sm' data-fim='" + m.id + "'>Concluir</button>" : "")
          + "<button class='btn sm sec' data-ed='" + m.id + "'>Editar</button>"
          + (m.situacao !== "cancelada"
              ? "<button class='btn sm sec' data-can='" + m.id + "'>Cancelar</button>" : "")
          + "</div>" : "")
      + "</div>";
  });
  A.$("ms-lista").innerHTML = h;

  const mudar = async (id, sit) => {
    const { error } = await A.sb.from("missoes").update({ situacao: sit }).eq("id", id);
    if (error) return A.toast(A.explicar(error), true);
    await carregar(); desenharDias(); desenharLista();
  };
  A.$("ms-lista").querySelectorAll("[data-and]").forEach(b =>
    b.onclick = () => mudar(Number(b.dataset.and), "em_andamento"));
  A.$("ms-lista").querySelectorAll("[data-fim]").forEach(b =>
    b.onclick = () => mudar(Number(b.dataset.fim), "concluida"));
  A.$("ms-lista").querySelectorAll("[data-can]").forEach(b =>
    b.onclick = () => mudar(Number(b.dataset.can), "cancelada"));
  A.$("ms-lista").querySelectorAll("[data-ed]").forEach(b =>
    b.onclick = () => modalMissao(MISSOES.find(m => m.id === Number(b.dataset.ed))));
}

/* --------------------------------------------------------- criar e editar */
function modalMissao(m){
  const novo = !m;
  m = m || {};
  const equipe = (EQUIPES[m.id] || []).map(p => p && p.id);

  A.modal(novo ? "Nova missão" : "Editar missão",
    '<div id="mm-msg"></div>'
    + '<div class="row"><label class="lab" for="m-tit">Título</label>'
    + '<input class="field" id="m-tit" value="' + A.esc(m.titulo || "")
    + '" placeholder="ex.: Conferência de carga da AR 1122"></div>'
    + '<div class="grid3"><div class="row"><label class="lab" for="m-data">Data</label>'
    + '<input class="field" id="m-data" type="date" value="' + (String(m.data || dia).slice(0,10)) + '"></div>'
    + '<div class="row"><label class="lab" for="m-turno">Turno</label>'
    + '<select class="field" id="m-turno">' + TURNOS.map(t =>
        '<option value="' + t + '"' + (t === m.turno ? " selected" : "") + ">" + t + "</option>").join("")
    + "</select></div>"
    + '<div class="row"><label class="lab" for="m-prio">Prioridade</label>'
    + '<select class="field" id="m-prio">' + Object.entries(PRIOR).map(([v,t]) =>
        '<option value="' + v + '"' + (v === m.prioridade ? " selected" : "") + ">" + t + "</option>").join("")
    + "</select></div></div>"
    + '<div class="row"><label class="lab" for="m-local">Local</label>'
    + '<select class="field" id="m-local"><option value="">(não se aplica)</option>'
    + A.opcoesLocais(m.local_id) + "</select></div>"
    + '<div class="row"><label class="lab" for="m-desc">O que precisa ser feito</label>'
    + '<textarea class="field" id="m-desc" placeholder="detalhe para quem for executar">'
    + A.esc(m.descricao || "") + "</textarea></div>"
    + '<div class="row"><label class="lab">Militares designados</label><div class="escolha" id="m-eq">'
    + A.perfis.map(p => '<label' + (equipe.includes(p.id) ? ' class="marcado"' : "") + '>'
        + '<input type="checkbox" value="' + p.id + '"' + (equipe.includes(p.id) ? " checked" : "")
        + "> " + A.esc(p.nome_guerra) + "</label>").join("")
    + "</div></div>",
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn" id="m-ok">Salvar missão</button>', true);

  A.$("m-eq").querySelectorAll("input").forEach(c =>
    c.onchange = () => c.parentElement.classList.toggle("marcado", c.checked));

  A.$("m-ok").onclick = () => {
    const tit = A.$("m-tit").value.trim();
    if (!tit){ A.$("mm-msg").innerHTML = '<div class="err">Informe o título da missão.</div>'; return; }
    A.salvar("m-ok", "mm-msg", async () => {
      const reg = {
        titulo: tit,
        data: A.$("m-data").value,
        turno: A.$("m-turno").value,
        prioridade: A.$("m-prio").value,
        local_id: A.$("m-local").value ? Number(A.$("m-local").value) : null,
        descricao: A.$("m-desc").value.trim() || null
      };
      let id = m.id;
      if (novo){
        const r = await A.sb.from("missoes").insert(reg).select().single();
        if (r.error) throw r.error;
        id = r.data.id;
      } else {
        const r = await A.sb.from("missoes").update(reg).eq("id", m.id);
        if (r.error) throw r.error;
      }
      // equipe: troca o conjunto inteiro, mais simples que calcular diferença
      await A.sb.from("missao_militares").delete().eq("missao_id", id);
      const sel = [...A.$("m-eq").querySelectorAll("input:checked")].map(c => c.value);
      if (sel.length){
        const r = await A.sb.from("missao_militares")
          .insert(sel.map(pid => ({ missao_id: id, perfil_id: pid })));
        if (r.error) throw r.error;
      }
      dia = reg.data;
      await carregar();
    }, novo ? "Missão lançada." : "Missão atualizada.");
  };
}

/* ---------------------------------------------------------------- registro */
A.missoes = { carregar, doDia, isoMais };
A.registrarAba("missoes", "Missões do dia", render, () => {
  const n = (A.resumo && A.resumo.missoes_hoje) || 0;
  return { qtd: n, urgente: false };
});
})();
