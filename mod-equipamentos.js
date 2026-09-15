/* =====================================================================
   MÓDULO EQUIPAMENTOS E MANUTENÇÃO
   Cobre DEA, material operacional da SMO e desencarceradores: tudo que
   tem patrimônio, fica num lugar e precisa de inspeção periódica.
   ===================================================================== */
"use strict";

(() => {
const abertos = new Set();
let busca = "", fCat = "todas", fSit = "todas";

const SITUACOES = {
  operacional:"Operacional", reserva:"Reserva", manutencao:"Em manutenção",
  baixado:"Baixado", emprestado:"Emprestado"
};
const TIPOS = { corretiva:"Corretiva", preventiva:"Preventiva", inspecao:"Inspeção", calibracao:"Calibração" };

const inspVencida = e => e.proxima_inspecao && A.diasAte(e.proxima_inspecao) < 0;
const inspPerto   = e => e.proxima_inspecao && A.diasAte(e.proxima_inspecao) >= 0 && A.diasAte(e.proxima_inspecao) <= 7;

function filtrados(){
  const q = busca.trim().toLowerCase();
  return A.equipamentos.filter(e => {
    if (fCat !== "todas" && e.categoria !== fCat) return false;
    if (fSit === "inspecao_vencida" && !inspVencida(e)) return false;
    if (fSit !== "todas" && fSit !== "inspecao_vencida" && e.situacao !== fSit) return false;
    if (q && !(e.nome + " " + (e.patrimonio||"") + " " + (e.marca||"") + " " + (e.local_nome||""))
             .toLowerCase().includes(q)) return false;
    return true;
  });
}

/* ----------------------------------------------------------------- render */
function render(sec){
  if (A.filtros.situacao){ fSit = A.filtros.situacao; fCat = "todas"; busca = ""; A.filtros = {}; }
  if (!A.equipamentos.length){
    sec.innerHTML = '<div class="panel"><div class="empty"><b>Nenhum equipamento cadastrado.</b>'
      + "Rode <b>sql/03-modulos.sql</b> e <b>sql/04-equipamentos.sql</b> no Supabase para carregar "
      + "os DEA, o material operacional da SMO e os desencarceradores.</div></div>";
    return;
  }
  const cats = Array.from(new Set(A.equipamentos.map(e => e.categoria))).sort();
  const pode = A.pode();

  sec.innerHTML = '<div class="cards" id="eq-cards"></div>'
    + '<div class="bar">'
    + '<button class="btn" id="eq-novo"' + (pode ? "" : " disabled") + ">Cadastrar equipamento</button>"
    + '<button class="btn sec" id="eq-csv">CSV</button>'
    + '<span class="sep"></span></div>'
    + '<div class="bar"><input class="field grow" id="eq-busca" type="search" value="' + A.esc(busca)
    + '" placeholder="Buscar por nome, patrimônio, marca ou local">'
    + '<select class="field auto" id="eq-cat"><option value="todas">Todas as categorias</option>'
    + cats.map(c => '<option' + (c === fCat ? " selected" : "") + ">" + A.esc(c) + "</option>").join("")
    + '</select><select class="field auto" id="eq-sit">'
    + '<option value="todas">Todas as situações</option>'
    + Object.entries(SITUACOES).map(([v,t]) =>
        '<option value="' + v + '"' + (v === fSit ? " selected" : "") + ">" + t + "</option>").join("")
    + '<option value="inspecao_vencida"' + (fSit === "inspecao_vencida" ? " selected" : "")
    + ">Inspeção vencida</option></select></div>"
    + '<div class="panel"><div class="phead"><h2>Equipamentos</h2><span class="cnt" id="eq-cnt"></span></div>'
    + '<div id="eq-tabela"></div></div>';

  desenharCards();
  desenharTabela();
  A.$("eq-busca").oninput  = e => { busca = e.target.value; desenharTabela(); };
  A.$("eq-cat").onchange   = e => { fCat = e.target.value; desenharTabela(); };
  A.$("eq-sit").onchange   = e => { fSit = e.target.value; desenharTabela(); };
  A.$("eq-novo").onclick   = () => modalEquip();
  A.$("eq-csv").onclick    = baixarCSV;
}

function desenharCards(){
  const t = s => A.equipamentos.filter(e => e.situacao === s).length;
  const disp = t("operacional") + t("reserva");
  const pct = A.equipamentos.length ? Math.round(disp / A.equipamentos.length * 100) : 0;
  const cards = [
    { c:"o", n:pct + "%", t:"disponibilidade da frota", u:disp + " de " + A.equipamentos.length + " prontos", f:"operacional" },
    { c:"a", n:t("manutencao"), t:"em manutenção", u:"fora de operação agora", f:"manutencao" },
    { c:"v", n:t("baixado"), t:"baixados", u:"aguardando decisão ou descarte", f:"baixado" },
    { c:"b", n:A.equipamentos.filter(inspVencida).length, t:"com inspeção vencida",
      u:"teste ou recarga fora do prazo", f:"inspecao_vencida" }
  ];
  A.$("eq-cards").innerHTML = cards.map(c =>
    '<button class="card ' + c.c + '" data-f="' + c.f + '"><div class="n num">' + c.n + "</div>"
    + '<div class="t">' + c.t + '</div><div class="u">' + A.esc(c.u) + "</div></button>").join("");
  A.$("eq-cards").querySelectorAll("[data-f]").forEach(b =>
    b.onclick = () => { fSit = b.dataset.f; fCat = "todas"; busca = ""; render(A.$("sec-equipamentos")); });
}

function desenharTabela(){
  const lista = filtrados();
  A.$("eq-cnt").textContent = lista.length + " de " + A.equipamentos.length;
  if (!lista.length){
    A.$("eq-tabela").innerHTML = '<div class="empty"><b>Nenhum equipamento nesse filtro.</b>'
      + "Ajuste a busca ou escolha outro filtro.</div>";
    return;
  }
  let h = "<table><thead><tr><th>Equipamento</th><th>Patrimônio</th><th>Local</th>"
    + "<th>Situação</th><th>Próxima inspeção</th><th>Leitura</th></tr></thead><tbody>";
  lista.forEach(e => {
    const d = A.diasAte(e.proxima_inspecao);
    const cls = inspVencida(e) ? "v" : inspPerto(e) ? "a" : d === null ? "s" : "o";
    h += '<tr class="item" data-id="' + e.id + '">'
      + "<td><div class='iname'><span class='chev'>" + (abertos.has(e.id) ? "▾" : "▸") + "</span>"
      + A.esc(e.nome) + "</div><div class='icat' style='padding-left:16px'>" + A.esc(e.categoria)
      + (e.marca ? " · " + A.esc(e.marca) : "") + "</div></td>"
      + "<td class='num' data-rot='Patrimônio' style='color:var(--muted)'>" + A.esc(e.patrimonio || "—") + "</td>"
      + "<td data-rot='Local'>" + A.esc(e.local_nome || "—") + "</td>"
      + '<td><span class="tag ' + e.situacao + '">' + SITUACOES[e.situacao] + "</span>"
      + (e.manut_abertas > 0 ? " <span class='tag a'>OS aberta</span>" : "") + "</td>"
      + "<td data-rot='Inspeção'>" + (e.proxima_inspecao
          ? '<span class="tag ' + cls + '">' + A.brData(e.proxima_inspecao) + "</span>"
            + "<div style='font-size:11px;color:var(--muted)'>"
            + (d < 0 ? "vencida há " + Math.abs(d) + " d" : "em " + d + " d") + "</div>"
          : '<span class="tag s">sem periodicidade</span>') + "</td>"
      + "<td data-rot='Leitura' style='color:var(--muted);font-size:12px'>" + A.esc(e.indicador || "—") + "</td>"
      + "</tr>";
    if (abertos.has(e.id)) h += '<tr class="sub"><td colspan="6"><div id="det-' + e.id
      + '"><div class="skel">Carregando histórico…</div></div></td></tr>';
  });
  A.$("eq-tabela").innerHTML = h + "</tbody></table>";

  document.querySelectorAll("#sec-equipamentos tr.item").forEach(tr => tr.onclick = () => {
    const id = Number(tr.dataset.id);
    abertos.has(id) ? abertos.delete(id) : abertos.add(id);
    desenharTabela();
  });
  lista.filter(e => abertos.has(e.id)).forEach(e => carregarDetalhe(e));
}

/* ------------------------------------------------- detalhe com histórico */
async function carregarDetalhe(e){
  const cx = A.$("det-" + e.id);
  if (!cx) return;
  const { data, error } = await A.sb.from("manutencoes")
    .select("*, perfis(nome_guerra)")
    .eq("equipamento_id", e.id).order("aberta_em", { ascending:false }).limit(30);
  if (!A.$("det-" + e.id)) return;

  const pode = A.pode();
  const aberta = (data || []).find(m => ["aberta","em_oficina"].includes(m.situacao));
  let h = "";

  if (error){
    h = '<div style="padding:14px 16px 4px 42px" class="err">' + A.esc(A.explicar(error)) + "</div>";
  } else if (!data.length){
    h = "<div style='padding:14px 16px 4px 42px;font-size:12.5px;color:var(--muted)'>"
      + "Nenhum registro de manutenção ou inspeção ainda.</div>";
  } else {
    h = "<table class='ltable'><thead><tr><th>Data</th><th>Tipo</th><th>Situação</th>"
      + "<th>Descrição</th><th>Oficina</th><th class='r'>Custo</th><th></th></tr></thead><tbody>";
    data.forEach(m => {
      const atrasada = ["aberta","em_oficina"].includes(m.situacao)
        && m.prazo && A.diasAte(m.prazo) < 0;
      h += "<tr><td class='num'>" + A.brData(m.aberta_em) + "</td>"
        + "<td data-rot='Tipo'>" + (TIPOS[m.tipo] || m.tipo) + "</td>"
        + '<td data-rot="Situação"><span class="tag ' + (atrasada ? "atrasado" : m.situacao) + '">'
        + (atrasada ? "Atrasada" : m.situacao) + "</span>"
        + (m.prazo && m.situacao !== "concluida"
            ? "<div style='font-size:11px;color:var(--muted)'>prazo " + A.brData(m.prazo) + "</div>" : "")
        + "</td>"
        + "<td data-rot='Descrição' style='font-size:12px'>" + A.esc(m.servico || m.defeito || "—")
        + (m.perfis ? "<div style='color:var(--muted);font-size:11px'>" + A.esc(m.perfis.nome_guerra) + "</div>" : "")
        + "</td>"
        + "<td data-rot='Oficina' style='color:var(--muted)'>" + A.esc(m.oficina || "—")
        + (m.documento ? "<div style='font-size:11px'>" + A.esc(m.documento) + "</div>" : "") + "</td>"
        + "<td class='r num' data-rot='Custo' style='color:var(--muted)'>"
        + (m.custo != null ? A.moeda(m.custo) : "—") + "</td>"
        + "<td class='r'>" + (pode && ["aberta","em_oficina"].includes(m.situacao)
            ? "<button class='btn sm' data-concluir='" + m.id + "'>Concluir</button>" : "") + "</td></tr>";
    });
    h += "</tbody></table>";
  }

  h += '<div class="acoes">' + (pode
    ? (e.periodicidade_dias ? "<button class='btn sm' data-insp='" + e.id + "'>Registrar inspeção</button>" : "")
      + (aberta ? "" : "<button class='btn sm sec' data-manut='" + e.id + "'>Abrir manutenção</button>")
      + "<button class='btn sm sec' data-mover='" + e.id + "'>Transferir</button>"
      + (A.eChefe() ? "<button class='btn sm sec' data-edit='" + e.id + "'>Editar cadastro</button>" : "")
    : "") + "</div>";

  cx.innerHTML = h;
  cx.querySelectorAll("[data-insp]").forEach(b => b.onclick = ev => { ev.stopPropagation(); modalInspecao(e); });
  cx.querySelectorAll("[data-manut]").forEach(b => b.onclick = ev => { ev.stopPropagation(); modalManutencao(e); });
  cx.querySelectorAll("[data-mover]").forEach(b => b.onclick = ev => { ev.stopPropagation(); modalMover(e); });
  cx.querySelectorAll("[data-edit]").forEach(b => b.onclick = ev => { ev.stopPropagation(); modalEquip(e); });
  cx.querySelectorAll("[data-concluir]").forEach(b =>
    b.onclick = ev => { ev.stopPropagation(); modalConcluir(Number(b.dataset.concluir), e); });
}

/* --------------------------------------------------------------- inspeção */
function modalInspecao(e){
  A.modal("Registrar inspeção — " + e.nome,
    '<div id="in-msg"></div>'
    + "<p style='font-size:12.5px;color:var(--muted);margin:0 0 14px'>"
    + "Periodicidade de <b>" + e.periodicidade_dias + " dias</b>. Ao salvar, a próxima fica agendada "
    + "para <b>" + A.brData(new Date(Date.now() + e.periodicidade_dias*86400000).toISOString().slice(0,10))
    + "</b> automaticamente.</p>"
    + '<div class="row"><label class="lab">Resultado</label><div class="escolha">'
    + '<label class="marcado"><input type="radio" name="conf" value="1" checked> Conforme</label>'
    + '<label><input type="radio" name="conf" value="0"> Com ressalva</label></div></div>'
    + '<div class="row"><label class="lab" for="in-ind">Leitura registrada</label>'
    + '<input class="field" id="in-ind" value="' + A.esc(e.indicador || "")
    + '" placeholder="ex.: Bateria 0.75, carga cheia, sem vazamento"></div>'
    + '<div class="row"><label class="lab" for="in-obs">Observação</label>'
    + '<input class="field" id="in-obs" placeholder="opcional"></div>',
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn" id="in-ok">Registrar inspeção</button>');

  marcarEscolha();
  A.$("in-ok").onclick = () => A.salvar("in-ok", "in-msg", async () => {
    const { error } = await A.sb.rpc("registrar_inspecao", {
      p_equip: e.id,
      p_indicador: A.$("in-ind").value.trim() || null,
      p_obs: A.$("in-obs").value.trim() || null,
      p_conforme: document.querySelector('input[name=conf]:checked').value === "1"
    });
    if (error) throw error;
  }, "Inspeção registrada. Próxima agendada.");
}

/* ------------------------------------------------------------- manutenção */
function modalManutencao(e){
  const d30 = new Date(Date.now() + 30*86400000).toISOString().slice(0,10);
  A.modal("Abrir manutenção — " + e.nome,
    '<div id="mn-msg"></div>'
    + "<p style='font-size:12.5px;color:var(--muted);margin:0 0 14px'>"
    + "Ao abrir, o equipamento sai de operação e passa a contar como indisponível no painel.</p>"
    + '<div class="grid2"><div class="row"><label class="lab" for="mn-tipo">Tipo</label>'
    + '<select class="field" id="mn-tipo">'
    + '<option value="corretiva">Corretiva</option><option value="preventiva">Preventiva</option>'
    + '<option value="calibracao">Calibração</option></select></div>'
    + '<div class="row"><label class="lab" for="mn-prazo">Prazo previsto</label>'
    + '<input class="field" id="mn-prazo" type="date" value="' + d30 + '"></div></div>'
    + '<div class="row"><label class="lab" for="mn-def">Defeito ou motivo</label>'
    + '<textarea class="field" id="mn-def" placeholder="ex.: bateria não segura carga; erro no autoteste"></textarea></div>'
    + '<div class="grid2"><div class="row"><label class="lab" for="mn-of">Oficina ou responsável</label>'
    + '<input class="field" id="mn-of" placeholder="opcional"></div>'
    + '<div class="row"><label class="lab" for="mn-doc">Documento (SEI, OS)</label>'
    + '<input class="field" id="mn-doc" placeholder="opcional"></div></div>',
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn" id="mn-ok">Abrir manutenção</button>');

  A.$("mn-ok").onclick = () => A.salvar("mn-ok", "mn-msg", async () => {
    const { error } = await A.sb.rpc("abrir_manutencao", {
      p_equip: e.id, p_tipo: A.$("mn-tipo").value,
      p_defeito: A.$("mn-def").value.trim() || null,
      p_prazo: A.$("mn-prazo").value || null,
      p_oficina: A.$("mn-of").value.trim() || null,
      p_documento: A.$("mn-doc").value.trim() || null
    });
    if (error) throw error;
  }, "Manutenção aberta. Equipamento fora de operação.");
}

function modalConcluir(manutId, e){
  A.modal("Concluir manutenção — " + e.nome,
    '<div id="cn-msg"></div>'
    + '<div class="row"><label class="lab" for="cn-serv">Serviço executado</label>'
    + '<textarea class="field" id="cn-serv" placeholder="ex.: bateria substituída; autoteste aprovado"></textarea></div>'
    + '<div class="grid2"><div class="row"><label class="lab" for="cn-custo">Custo (R$)</label>'
    + '<input class="field num" id="cn-custo" type="number" min="0" step="0.01" placeholder="opcional"></div>'
    + '<div class="row"><label class="lab" for="cn-fim">Situação final</label>'
    + '<select class="field" id="cn-fim"><option value="operacional">Volta a operacional</option>'
    + '<option value="reserva">Vai para reserva</option>'
    + '<option value="baixado">Baixado, sem conserto</option></select></div></div>',
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn" id="cn-ok">Concluir</button>');

  A.$("cn-ok").onclick = () => {
    const serv = A.$("cn-serv").value.trim();
    if (!serv){ A.$("cn-msg").innerHTML = '<div class="err">Descreva o serviço executado.</div>'; return; }
    A.salvar("cn-ok", "cn-msg", async () => {
      const custo = parseFloat(A.$("cn-custo").value);
      const { error } = await A.sb.rpc("concluir_manutencao", {
        p_manut: manutId, p_servico: serv,
        p_custo: isNaN(custo) ? null : custo,
        p_situacao_final: A.$("cn-fim").value
      });
      if (error) throw error;
    }, "Manutenção concluída.");
  };
}

/* ------------------------------------------------------------ transferência */
function modalMover(e){
  A.modal("Transferir — " + e.nome,
    '<div id="mv-msg"></div>'
    + "<p style='font-size:12.5px;color:var(--muted);margin:0 0 14px'>Local atual: <b>"
    + A.esc(e.local_nome || "sem local") + "</b></p>"
    + '<div class="row"><label class="lab" for="mv-local">Novo local</label>'
    + '<select class="field" id="mv-local">' + A.opcoesLocais(e.local_id) + "</select></div>"
    + '<div class="row"><label class="lab" for="mv-obs">Observação</label>'
    + '<input class="field" id="mv-obs" placeholder="ex.: cautela nº 12/2026"></div>'
    + '<div class="hint">A transferência entra no histórico do equipamento.</div>',
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn" id="mv-ok">Transferir</button>');

  A.$("mv-ok").onclick = () => A.salvar("mv-ok", "mv-msg", async () => {
    const { error } = await A.sb.rpc("mover_equipamento", {
      p_equip: e.id, p_local: Number(A.$("mv-local").value),
      p_obs: A.$("mv-obs").value.trim() || null });
    if (error) throw error;
  }, "Equipamento transferido.");
}

/* ------------------------------------------------------- cadastro e edição */
function modalEquip(e){
  const novo = !e;
  e = e || {};
  const cats = Array.from(new Set(A.equipamentos.map(x => x.categoria).concat(
    ["DEA","FEA","INCÊNDIO","APH","EPI","SALVAMENTO","SAQ","DESENCARCERADOR","OUTRO"]))).sort();
  A.modal(novo ? "Cadastrar equipamento" : "Editar — " + e.nome,
    '<div id="eq-msg"></div>'
    + '<div class="row"><label class="lab" for="q-nome">Nome</label>'
    + '<input class="field" id="q-nome" value="' + A.esc(e.nome || "") + '" placeholder="ex.: DEA PHILIPS FRx"></div>'
    + '<div class="grid3"><div class="row"><label class="lab" for="q-cat">Categoria</label>'
    + '<select class="field" id="q-cat">' + cats.map(c =>
        "<option" + (c === e.categoria ? " selected" : "") + ">" + A.esc(c) + "</option>").join("") + "</select></div>"
    + '<div class="row"><label class="lab" for="q-patr">Patrimônio</label>'
    + '<input class="field" id="q-patr" value="' + A.esc(e.patrimonio || "") + '" placeholder="opcional"></div>'
    + '<div class="row"><label class="lab" for="q-marca">Marca</label>'
    + '<input class="field" id="q-marca" value="' + A.esc(e.marca || "") + '" placeholder="opcional"></div></div>'
    + '<div class="grid3"><div class="row"><label class="lab" for="q-local">Local</label>'
    + '<select class="field" id="q-local"><option value="">(sem local)</option>'
    + A.opcoesLocais(e.local_id) + "</select></div>"
    + '<div class="row"><label class="lab" for="q-sit">Situação</label>'
    + '<select class="field" id="q-sit">' + Object.entries(SITUACOES).map(([v,t]) =>
        '<option value="' + v + '"' + (v === e.situacao ? " selected" : "") + ">" + t + "</option>").join("")
    + "</select></div>"
    + '<div class="row"><label class="lab" for="q-per">Inspeção a cada (dias)</label>'
    + '<input class="field num" id="q-per" type="number" min="0" value="' + (e.periodicidade_dias || "")
    + '" placeholder="em branco = sem inspeção"></div></div>'
    + '<div class="row"><label class="lab" for="q-obs">Observação</label>'
    + '<input class="field" id="q-obs" value="' + A.esc(e.obs || "") + '" placeholder="opcional"></div>'
    + '<div class="hint">DEA testa a cada 7 dias; extintor recarrega a cada 365; desencarcerador confere a cada 180.</div>',
    '<button class="btn sec" onclick="A.fecharModal()">Cancelar</button>'
    + '<button class="btn" id="q-ok">Salvar</button>', true);

  A.$("q-ok").onclick = () => {
    const nome = A.$("q-nome").value.trim();
    if (!nome){ A.$("eq-msg").innerHTML = '<div class="err">Informe o nome do equipamento.</div>'; return; }
    A.salvar("q-ok", "eq-msg", async () => {
      const per = parseInt(A.$("q-per").value, 10);
      const reg = {
        nome, categoria: A.$("q-cat").value,
        patrimonio: A.$("q-patr").value.trim() || null,
        marca: A.$("q-marca").value.trim() || null,
        local_id: A.$("q-local").value ? Number(A.$("q-local").value) : null,
        situacao: A.$("q-sit").value,
        periodicidade_dias: isNaN(per) || per <= 0 ? null : per,
        obs: A.$("q-obs").value.trim() || null
      };
      const r = novo
        ? await A.sb.from("equipamentos").insert(reg)
        : await A.sb.from("equipamentos").update(reg).eq("id", e.id);
      if (r.error) throw r.error;
    }, novo ? "Equipamento cadastrado." : "Cadastro atualizado.");
  };
}

/** Marca visualmente a opção escolhida nos grupos de rádio em pílula. */
function marcarEscolha(){
  document.querySelectorAll(".escolha input[type=radio]").forEach(r => {
    r.onchange = () => {
      document.querySelectorAll('.escolha input[name="' + r.name + '"]').forEach(o =>
        o.parentElement.classList.toggle("marcado", o.checked));
    };
  });
}
A.marcarEscolha = marcarEscolha;

/* --------------------------------------------------------------------- CSV */
function baixarCSV(){
  const L = [["NOME","CATEGORIA","PATRIMONIO","MARCA","LOCAL","SITUACAO",
              "PERIODICIDADE_DIAS","ULTIMA_INSPECAO","PROXIMA_INSPECAO","LEITURA","OBS"]];
  A.equipamentos.forEach(e => L.push([e.nome, e.categoria, e.patrimonio || "", e.marca || "",
    e.local_nome || "", SITUACOES[e.situacao], e.periodicidade_dias || "",
    A.brData(e.ultima_inspecao), A.brData(e.proxima_inspecao), e.indicador || "", e.obs || ""]));
  const csv = "\uFEFF" + L.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" }));
  a.download = "equipamentos-smo-" + A.hojeISO() + ".csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------------------------------------------------------- registro */
A.registrarAba("equipamentos", "Equipamentos", render, () => {
  const n = A.equipamentos.filter(e => inspVencida(e) || e.situacao === "manutencao").length;
  return { qtd: n, urgente: A.equipamentos.some(inspVencida) };
});
})();
