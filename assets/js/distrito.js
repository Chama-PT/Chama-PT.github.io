/* ChamaPT — páginas de distrito (mapa SVG, lista e detalhe por concelho) */
(function (g) {
  'use strict';
  var C = g.CHAMA;
  var $ = function (id) { return document.getElementById(id); };
  var B = document.body;
  var SLUG = B.dataset.distrito, PREFIXO = B.dataset.prefixo, NOME = B.dataset.nome;
  var CONC = C.CONCELHOS.filter(function (c) { return c[0].indexOf(PREFIXO) === 0; })
    .map(function (c) { return { dico: c[0], nome: c[1] }; })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt'); });
  var dados = null, sel = null;

  function rcmDe(dico) { return C.getRCM(dados, dico); }
  function pathDe(dico) { return $('c-' + dico); }

  function pintarMapa() {
    CONC.forEach(function (c) {
      var el = pathDe(c.dico); if (!el) return;
      var n = rcmDe(c.dico), lv = C.LEVELS[n];
      el.style.fill = lv ? lv.fill : '#22222e';
      el.style.stroke = lv ? lv.cor : '#4a4a5c';
      el.style.strokeWidth = lv ? '0.8' : '0.5';
      el.setAttribute('aria-label', c.nome + ', perigo de incêndio ' + C.nivelTexto(n).toLowerCase());
    });
  }
  function lista() {
    $('concelhos-list').innerHTML = CONC.map(function (c) {
      var n = dados ? rcmDe(c.dico) : null;
      var cor = C.LEVELS[n] ? C.LEVELS[n].cor : 'transparent';
      return '<li><button type="button" class="c-row' + (sel === c.dico ? ' active' : '') + '" id="row-' + c.dico + '" data-dico="' + c.dico + '" style="border-left-color:' + (sel === c.dico ? cor : 'transparent') + '">' +
        '<span class="c-row-name">' + C.esc(c.nome) + '</span><span class="c-badge lv' + (n || 0) + '">' + (dados ? C.esc(C.nivelTexto(n)) : '…') + '</span></button></li>';
    }).join('');
  }
  function estatisticas() {
    var cont = C.contarNiveis(dados, CONC.map(function (c) { return c.dico; }));
    [1, 2, 3, 4, 5].forEach(function (n) { var e = $('s' + n); if (e) e.textContent = cont[n]; });
  }
  function detalhe(dico, rolar) {
    if (!dados) return;
    var c = CONC.filter(function (x) { return x.dico === dico; })[0]; if (!c) return;
    sel = dico;
    var n = rcmDe(dico), lv = C.LEVELS[n];
    $('empty-panel').hidden = true; $('detail-panel').hidden = false;
    var nome = $('d-name'); nome.textContent = c.nome; nome.className = 'detail-name lv' + (n || 0);
    $('d-date').textContent = C.fmtCompleto(dados.dataPrev || C.hojeISO());
    var r = $('d-rcm-label'); r.textContent = C.nivelTexto(n); r.className = 'detail-rcm-label lv' + (n || 0);
    $('d-gauge').innerHTML = C.gaugeSVG(n, false);
    $('d-summary').textContent = n ? C.RULES[n].resumo : 'Sem dados do IPMA para este concelho.';
    $('d-rules').innerHTML = C.regrasHTML(n, 'block');
    Array.prototype.forEach.call(document.querySelectorAll('.c-path'), function (p) { p.classList.remove('active'); });
    var p = pathDe(dico); if (p) p.classList.add('active');
    lista();
    if (rolar && g.innerWidth <= 900) $('detail-region').scrollIntoView({ behavior: 'smooth', block: 'start' });
    var sr = $('estado-sr'); if (sr) sr.textContent = c.nome + ': perigo de incêndio ' + C.nivelTexto(n).toLowerCase() + '.';
  }

  async function carregar() {
    try {
      dados = await C.fetchIPMA(0);
      $('aviso-erro').hidden = true;
      pintarMapa(); estatisticas(); lista();
      $('atualizacao').textContent = 'Dados do IPMA' + (dados.fileDate ? ' · atualizados em ' + C.fmtDataHora(dados.fileDate) : '') + ' · volta a verificar a cada 30 minutos.';
      if (dados.dataPrev && dados.dataPrev !== C.hojeISO()) {
        $('aviso-data').innerHTML = '<strong>Atenção:</strong> os dados mais recentes do IPMA são de ' + C.esc(C.fmtLongo(dados.dataPrev)) + ' e podem não refletir as condições de hoje.';
        $('aviso-data').hidden = false;
      } else $('aviso-data').hidden = true;
      if (sel) detalhe(sel, false);
    } catch (e) {
      var tem = !!dados;
      $('aviso-erro').innerHTML = (tem ? 'Não foi possível atualizar os dados do IPMA; estão a ser mostrados os últimos obtidos.' : 'Não foi possível obter os dados do IPMA. Verifique a ligação à Internet e tente novamente.') +
        ' Consulte <a href="https://www.ipma.pt/pt/riscoincendio/rcm.pt/" target="_blank" rel="noopener noreferrer">ipma.pt</a>.' +
        (tem ? '' : '<br><button type="button" class="btn btn--ghost" id="btn-repetir">Tentar novamente</button>');
      $('aviso-erro').hidden = false;
      var b = $('btn-repetir'); if (b) b.addEventListener('click', carregar);
    }
  }

  /* Zoom e arrasto do mapa (Ctrl + roda do rato, pinça, botões; arrasto quando ampliado) */
  function zoom() {
    var wrap = document.querySelector('.map-zoom-wrap'), svg = wrap && wrap.querySelector('svg');
    if (!wrap || !svg) return;
    var scale = 1, tx = 0, ty = 0, drag = false, sx = 0, sy = 0, lx = 0, ly = 0, ld = 0;
    function limitar(s, x, y) {
      var r = wrap.getBoundingClientRect(), h = svg.getBoundingClientRect().height / (scale || 1);
      var mx = Math.max(0, (r.width * s - r.width) / 2), my = Math.max(0, (h * s - r.height) / 2);
      return [Math.max(-mx, Math.min(mx, x)), Math.max(-my, Math.min(my, y))];
    }
    function aplicar() {
      var p = limitar(scale, tx, ty); tx = p[0]; ty = p[1];
      svg.style.transformOrigin = 'center center';
      svg.style.transform = 'scale(' + scale + ') translate(' + (tx / scale) + 'px,' + (ty / scale) + 'px)';
      wrap.classList.toggle('is-zoomed', scale > 1);
    }
    function definir(s) { scale = Math.max(1, Math.min(6, s)); if (scale <= 1) { tx = 0; ty = 0; } aplicar(); }
    $('zoom-in').addEventListener('click', function () { definir(scale * 1.35); });
    $('zoom-out').addEventListener('click', function () { definir(scale / 1.35); });
    $('zoom-reset').addEventListener('click', function () { scale = 1; tx = 0; ty = 0; aplicar(); });
    wrap.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;          /* sem Ctrl, a roda continua a deslocar a página */
      e.preventDefault(); definir(scale * (e.deltaY > 0 ? 1 / 1.15 : 1.15));
    }, { passive: false });
    wrap.addEventListener('mousedown', function (e) {
      if (scale <= 1) return; drag = true; sx = e.clientX; sy = e.clientY; lx = tx; ly = ty; wrap.classList.add('dragging'); e.preventDefault();
    });
    g.addEventListener('mousemove', function (e) { if (!drag) return; tx = lx + (e.clientX - sx); ty = ly + (e.clientY - sy); aplicar(); });
    g.addEventListener('mouseup', function () { drag = false; wrap.classList.remove('dragging'); });
    wrap.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) ld = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      else if (e.touches.length === 1 && scale > 1) { drag = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; lx = tx; ly = ty; }
    }, { passive: true });
    wrap.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        definir(scale * (d / ld)); ld = d;
      } else if (drag && e.touches.length === 1) { e.preventDefault(); tx = lx + (e.touches[0].clientX - sx); ty = ly + (e.touches[0].clientY - sy); aplicar(); }
    }, { passive: false });
    wrap.addEventListener('touchend', function () { drag = false; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    C.initMenuDistritos(SLUG);
    /* mapa: ligar cada concelho a rato e teclado */
    CONC.forEach(function (c) {
      var el = pathDe(c.dico); if (!el) return;
      el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', c.nome);
      el.addEventListener('click', function () { detalhe(c.dico, true); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); detalhe(c.dico, true); } });
    });
    $('concelhos-list').addEventListener('click', function (e) { var b = e.target.closest('button[data-dico]'); if (b) detalhe(b.dataset.dico, true); });
    lista(); zoom(); carregar();
    C.autoAtualizar(carregar);
  });
})(window);
