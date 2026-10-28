/*
 * ChamaPT — núcleo partilhado (página principal e páginas de distrito).
 * Sem dependências. Requer concelhos.js carregado antes.
 */
(function (g) {
  'use strict';
  var C = (g.CHAMA = g.CHAMA || {});

  /* ── Níveis de perigo (escala IPMA) ─────────────────────────── */
  C.LEVELS = {
    1: { nome: 'Reduzido',      cor: '#2ec27e', fill: '#0e3020' },
    2: { nome: 'Moderado',      cor: '#ffd166', fill: '#382e08' },
    3: { nome: 'Elevado',       cor: '#f4831f', fill: '#3a1c06' },
    4: { nome: 'Muito Elevado', cor: '#e63946', fill: '#3a0810' },
    5: { nome: 'Máximo',        cor: '#8b0000', fill: '#280404' }
  };

  /*
   * Condicionantes por nível de perigo.
   * Fonte: ICNF, «Restrições associadas ao perigo de incêndio rural diário (PIR)»,
   * com base no Decreto-Lei n.º 82/2021 (redação do DL n.º 56/2023).
   * As restrições gerais aplicam-se nos níveis Muito Elevado e Máximo; nos restantes,
   * queimas e queimadas dependem de autorização/comunicação ao município.
   * É um RESUMO informativo: rever sempre que a legislação mudar.
   */
  C.FONTE_REGRAS = 'https://fogos.icnf.pt/SGIF2010/InformacaoPublicaDados/Condicionantes_PerigoIncendiosRural.pdf';

  var BAIXO = {
    resumo: 'Neste nível não há proibições gerais associadas ao perigo de incêndio. Queimas e queimadas continuam a exigir autorização ou comunicação ao município.',
    proibido: [
      'Queimadas sem autorização do município',
      'Queima de amontoados sem autorização ou comunicação prévia ao município'
    ],
    permitido: [
      'Queimadas, mediante autorização do município',
      'Queima de amontoados, com autorização ou comunicação prévia',
      'Fogueiras, fogareiros e grelhadores em espaço rural',
      'Maquinaria agrícola e florestal'
    ]
  };
  var ALTO = {
    resumo: 'Estão em vigor as restrições mais severas: queimadas, fogueiras, foguetes e fumar ou fazer lume em espaço rural são proibidos, entre outras.',
    proibido: [
      'Queimadas',
      'Queima de amontoados (salvo autorização excecional do município)',
      'Fogueiras para recreio, lazer ou festas populares',
      'Fogareiros e grelhadores fora de locais identificados para o efeito',
      'Fumar ou fazer qualquer tipo de lume em espaço rural',
      'Balões de mecha acesa e foguetes (outra pirotecnia só com autorização da câmara municipal)',
      'Fumigar ou desinfestar apiários com fogo ou fontes de calor',
      'Máquinas sem extintores e dispositivos de retenção de faíscas, e equipamentos que gerem faíscas ou calor (motorroçadoras, corta-matos, destroçadores, motosserras, rebarbadoras)',
      'Circular ou permanecer em áreas florestais públicas ou comunitárias inseridas em APPS',
      'Eventos com concentração de pessoas em território florestal em APPS, e drones ou sobrevoo sobre APPS'
    ],
    permitido: [
      'Grelhadores e fogareiros em locais devidamente identificados para o efeito',
      'Máquinas agrícolas e florestais do pôr do sol até às 11h, com condições de segurança',
      'Exploração florestal (corte e rechega) e faixas de gestão de combustível, se autorizadas pela proteção civil municipal'
    ]
  };
  C.RULES = { 1: BAIXO, 2: BAIXO, 3: BAIXO, 4: ALTO, 5: ALTO };

  /* ── Utilitários ────────────────────────────────────────────── */
  var MESES_C = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var MESES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  C.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  };
  C.normalize = function (s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_]/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  };
  function pad(n) { return String(n).padStart(2, '0'); }
  C.hojeISO = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  C.parseISO = function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  C.fmtCurto = function (s) { var d = C.parseISO(s); return d ? pad(d.getDate()) + ' ' + MESES_C[d.getMonth()] + ' · ' + DIAS[d.getDay()] : ''; };
  C.fmtLongo = function (s) { var d = C.parseISO(s); return d ? d.getDate() + ' de ' + MESES_L[d.getMonth()] : ''; };
  C.fmtCompleto = function (s) { var d = C.parseISO(s); return d ? DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES_L[d.getMonth()] + ' de ' + d.getFullYear() : ''; };
  C.fmtDataHora = function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] + ' às ' + m[4] + ':' + m[5] : '';
  };

  /* ── Concelhos ──────────────────────────────────────────────── */
  var porDico = null, indice = null;
  function build() {
    if (porDico) return;
    porDico = {}; indice = [];
    (C.CONCELHOS || []).forEach(function (c) { porDico[c[0]] = c[1]; indice.push({ dico: c[0], nome: c[1], norm: C.normalize(c[1]) }); });
  }
  C.nomeConcelho = function (dico) { build(); return porDico[dico] || null; };
  C.nomeDistrito = function (dico) { return (C.DISTRITOS || {})[String(dico).slice(0, 2)] || ''; };
  C.rotuloConcelho = function (dico) {
    var n = C.nomeConcelho(dico); if (!n) return '';
    var d = C.nomeDistrito(dico);
    return 'Concelho de ' + n + (d ? ' · Distrito de ' + d : '');
  };
  /* Correspondência EXATA (sem acentos/maiúsculas). Devolve o DICO ou null. */
  C.dicoExato = function (texto) {
    build(); var q = C.normalize(texto); if (!q) return null;
    for (var i = 0; i < indice.length; i++) if (indice[i].norm === q) return indice[i].dico;
    return null;
  };
  /* Pesquisa por texto: exatos, depois prefixos, depois contém. */
  C.procurar = function (texto, max) {
    build(); var q = C.normalize(texto); if (q.length < 2) return [];
    var ex = [], pre = [], con = [];
    indice.forEach(function (c) {
      if (c.norm === q) ex.push(c); else if (c.norm.indexOf(q) === 0) pre.push(c); else if (c.norm.indexOf(q) > -1) con.push(c);
    });
    return ex.concat(pre, con).slice(0, max || 6);
  };

  /* ── IPMA ───────────────────────────────────────────────────── */
  C.ipmaUrl = function (dia) { return 'https://api.ipma.pt/open-data/forecast/meteorology/rcm/rcm-d' + dia + '.json'; };
  /* Pedido direto ao IPMA (sem proxies de terceiros: os dados têm de ser íntegros). */
  C.fetchIPMA = async function (dia) {
    var erro;
    for (var tentativa = 0; tentativa < 2; tentativa++) {
      var ctrl = new AbortController();
      var t = setTimeout(function () { ctrl.abort(); }, 12000);
      try {
        var r = await fetch(C.ipmaUrl(dia), { cache: 'no-cache', signal: ctrl.signal });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var j = await r.json();
        if (!j || typeof j.local !== 'object' || j.local === null) throw new Error('Formato inesperado');
        return j;
      } catch (e) {
        erro = e;
        await new Promise(function (res) { setTimeout(res, 1200); });
      } finally { clearTimeout(t); }
    }
    throw erro || new Error('IPMA indisponível');
  };
  /* Nível 1–5 ou null (nunca assume um valor por omissão). */
  C.getRCM = function (dados, dico) {
    var e = dados && dados.local && dados.local[dico];
    if (!e) return null;
    var v = e.data && e.data.rcm != null ? e.data.rcm : e.rcm;
    var n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };
  C.contarNiveis = function (dados, dicos) {
    var cont = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    dicos.forEach(function (d) { var n = C.getRCM(dados, d); if (n) cont[n]++; });
    return cont;
  };

  /* ── Manómetro (SVG decorativo; o texto transmite o nível) ──── */
  function xy(ang, cx, cy, r) { var a = ang * Math.PI / 180; return [+(cx + r * Math.cos(a)).toFixed(1), +(cy + r * Math.sin(a)).toFixed(1)]; }
  C.gaugeSVG = function (rcm, grande) {
    var vb = grande ? 280 : 140, c = vb / 2, vbox = grande ? '0 20 280 220' : '0 0 140 140', r = grande ? 100 : 46, sw = grande ? 22 : 11, rb = grande ? 130 : 62;
    var circ = 2 * Math.PI * r, seg = circ * 0.15, gap = r * 0.03;
    var cores = ['#2ec27e', '#ffd166', '#f4831f', '#e63946', '#8b0000'];
    var rot = 'rotate(135 ' + c + ' ' + c + ')';
    var s = '<svg class="' + (grande ? 'big-gauge' : 'mini-gauge') + '" viewBox="' + vbox + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      (grande ? '' : '<circle cx="' + c + '" cy="' + c + '" r="' + rb + '" fill="#0a0a0c"/><circle cx="' + c + '" cy="' + c + '" r="' + rb + '" fill="none" stroke="#1e1e26"/>') +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="#1c1c28" stroke-width="' + sw + '" stroke-dasharray="' + (circ * 0.75).toFixed(1) + ' ' + (circ * 0.25).toFixed(1) + '" transform="' + rot + '"/>';
    cores.forEach(function (cor, i) {
      s += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + cor + '" stroke-width="' + sw + '" stroke-dasharray="' + (seg - gap).toFixed(1) + ' ' + (circ - seg + gap).toFixed(1) + '" stroke-dashoffset="' + (-i * seg).toFixed(1) + '" transform="' + rot + '"/>';
    });
    if (rcm >= 1 && rcm <= 5) {
      var p = xy(162 + 54 * (rcm - 1), c, c, grande ? 78 : 36);
      s += '<line x1="' + c + '" y1="' + c + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="#f5f0e8" stroke-width="' + (grande ? 3 : 2) + '" stroke-linecap="round"/>';
    }
    s += '<circle cx="' + c + '" cy="' + c + '" r="' + (grande ? 11 : 5) + '" fill="#f5f0e8"/><circle cx="' + c + '" cy="' + c + '" r="' + (grande ? 6 : 2.5) + '" fill="#0a0a0c"/></svg>';
    return s;
  };
  /* Nome do nível em HTML (duas linhas se tiver duas palavras). */
  C.nivelHTML = function (rcm) {
    var lv = C.LEVELS[rcm];
    return C.esc(lv ? lv.nome : 'Sem dados');
  };
  C.nivelTexto = function (rcm) { return C.LEVELS[rcm] ? C.LEVELS[rcm].nome : 'Sem dados'; };

  /* ── Condicionantes (HTML) ──────────────────────────────────── */
  function lista(itens) { return itens.map(function (i) { return '<li>' + C.esc(i) + '</li>'; }).join(''); }
  /* variante 'card' (página principal) ou 'block' (detalhe de distrito) */
  C.regrasHTML = function (rcm, variante) {
    var r = C.RULES[rcm];
    var b = variante === 'block';
    if (!r) return '<p class="rule-empty">Sem dados do IPMA para este local. Consulte <a href="https://www.ipma.pt/pt/riscoincendio/rcm.pt/" target="_blank" rel="noopener noreferrer">ipma.pt</a> e a sua câmara municipal antes de utilizar fogo.</p>';
    return '<div class="' + (b ? 'rule-block rule-block--no' : 'rule-card rule-card--no') + '"><h3 class="' + (b ? 'rule-head-sm' : 'rule-head') + '"><span aria-hidden="true">✕</span> Proibido</h3><ul class="' + (b ? 'rule-ul' : 'rule-list') + '">' + lista(r.proibido) + '</ul></div>' +
      '<div class="' + (b ? 'rule-block rule-block--ok' : 'rule-card rule-card--ok') + '"><h3 class="' + (b ? 'rule-head-sm' : 'rule-head') + '"><span aria-hidden="true">✓</span> Permitido, com condições</h3><ul class="' + (b ? 'rule-ul' : 'rule-list') + '">' + lista(r.permitido) + '</ul></div>';
  };

  /* ── Menu de distritos (acessível) ──────────────────────────── */
  var DISTRITOS_COM_PAGINA = [
    { slug: 'aveiro', nome: 'Aveiro' }, { slug: 'guarda', nome: 'Guarda' },
    { slug: 'porto', nome: 'Porto' }, { slug: 'viseu', nome: 'Viseu' }
  ];
  C.initMenuDistritos = function (slugAtual) {
    var btn = document.getElementById('dd-trigger'), menu = document.getElementById('dd-menu');
    if (!btn || !menu) return;
    var atual = DISTRITOS_COM_PAGINA.filter(function (d) { return d.slug === slugAtual; })[0];
    var cur = document.getElementById('dd-current');
    if (cur) cur.textContent = atual ? atual.nome : 'Escolher';
    menu.innerHTML = '<li class="dd-title" aria-hidden="true">Selecionar distrito</li>' + DISTRITOS_COM_PAGINA.map(function (d) {
      return '<li><a href="/' + d.slug + '/"' + (d.slug === slugAtual ? ' aria-current="page"' : '') + '>' + d.nome + '</a></li>';
    }).join('');
    function abrir(v) { menu.hidden = !v; btn.setAttribute('aria-expanded', v ? 'true' : 'false'); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); abrir(menu.hidden); });
    document.addEventListener('click', function (e) { if (!menu.contains(e.target)) abrir(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { abrir(false); btn.focus(); } });
    menu.addEventListener('focusout', function (e) { if (e.relatedTarget && !menu.contains(e.relatedTarget) && e.relatedTarget !== btn) abrir(false); });
  };

  /* ── Atualização automática (silenciosa, só com a página visível) ── */
  C.autoAtualizar = function (fn, ms) {
    ms = ms || 30 * 60 * 1000;
    var ultima = Date.now();
    function correr() { ultima = Date.now(); fn(); }
    setInterval(function () { if (!document.hidden) correr(); }, ms);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - ultima > ms) correr(); });
  };
})(window);
