/* ChamaPT — página principal */
(function (g) {
  'use strict';
  var C = g.CHAMA;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'chamapt.concelho';
  var S = { d0: null, d1: null, dico: null, origem: null };
  var TODOS = C.CONCELHOS.map(function (c) { return c[0]; });

  /* Armazenamento local: apenas o código do concelho escolhido pelo utilizador. */
  function lerGuardado() { try { var v = g.localStorage.getItem(KEY); return v && C.nomeConcelho(v) ? v : null; } catch (e) { return null; } }
  function guardar(d) { try { if (d) g.localStorage.setItem(KEY, d); else g.localStorage.removeItem(KEY); } catch (e) { /* sem armazenamento: ignora */ } }

  function msg(texto, erro) {
    var m = $('locate-msg'); if (!m) return;
    m.textContent = texto || ''; m.classList.toggle('is-error', !!erro);
  }
  function aviso(id, html) { var el = $(id); if (!el) return; el.hidden = !html; if (html != null) el.innerHTML = html; }

  /* ── Renderização ───────────────────────────────────────────── */
  var ultimoSR = '';
  function render() {
    var d0 = S.d0, d1 = S.d1, tem = !!S.dico;
    var rcm0 = tem && d0 ? C.getRCM(d0, S.dico) : null;
    var rcm1 = tem && d1 ? C.getRCM(d1, S.dico) : null;
    var hoje = C.hojeISO();
    var data0 = (d0 && d0.dataPrev) || hoje;
    var data1 = d1 && d1.dataPrev;
    var rotulo = tem ? C.rotuloConcelho(S.dico) : '';

    $('local-nome').textContent = rotulo || 'Risco de incêndio · Portugal Continental';

    /* manómetro principal */
    var cls, nivelHTML, dataTxt;
    if (!d0) { cls = 'lv0'; nivelHTML = 'A carregar'; dataTxt = 'IPMA'; }
    else if (!tem) { cls = 'lv0'; nivelHTML = 'Escolha o concelho'; dataTxt = data0 === hoje ? 'Hoje · ' + C.fmtLongo(data0) : C.fmtLongo(data0); }
    else { cls = 'lv' + (rcm0 || 0); nivelHTML = C.nivelHTML(rcm0); dataTxt = data0 === hoje ? 'Hoje · ' + C.fmtLongo(data0) : 'Dados de ' + C.fmtLongo(data0); }
    $('gauge-svg').innerHTML = C.gaugeSVG(rcm0, true);
    var lvEl = $('gauge-level'); lvEl.className = 'gauge-level ' + cls; lvEl.innerHTML = nivelHTML;
    $('gauge-date').textContent = dataTxt;

    /* data desatualizada face ao dia do dispositivo */
    if (d0 && data0 !== hoje) {
      aviso('aviso-data', '<strong>Atenção:</strong> os dados mais recentes do IPMA são de ' + C.esc(C.fmtLongo(data0)) + ' e podem não refletir as condições de hoje. Consulte <a href="https://www.ipma.pt/pt/riscoincendio/rcm.pt/" target="_blank" rel="noopener noreferrer">ipma.pt</a>.');
    } else aviso('aviso-data', null);

    /* previsão */
    var secDias = $('days-section');
    secDias.hidden = !(tem && d0);
    if (tem && d0) {
      var cartoes = [[data0, rcm0]]; if (d1) cartoes.push([data1, rcm1]);
      $('days-grid').innerHTML = cartoes.map(function (c) {
        return '<article class="day-card"><h3 class="day-name">' + C.esc(C.fmtCurto(c[0])) + '</h3>' + C.gaugeSVG(c[1], false) +
          '<p class="day-level lv' + (c[1] || 0) + '">' + C.nivelHTML(c[1]) + '</p></article>';
      }).join('');
    }

    /* condicionantes */
    var secReg = $('rules-section'); secReg.hidden = !(tem && d0);
    if (tem && d0) {
      $('cond-label').textContent = rcm0 ? 'Condicionantes · nível ' + C.nivelTexto(rcm0) : 'Condicionantes';
      $('rules-grid').innerHTML = C.regrasHTML(rcm0, 'card');
      $('rules-grid').style.display = rcm0 ? '' : 'block';
    }

    /* escala: marca o nível atual */
    Array.prototype.forEach.call(document.querySelectorAll('.scale-item'), function (li) {
      if (rcm0 && +li.dataset.nivel === rcm0) li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current');
    });

    /* resumo nacional */
    var secNac = $('national-section'); secNac.hidden = !d0;
    if (d0) {
      var cont = C.contarNiveis(d0, TODOS), total = 0;
      [1, 2, 3, 4, 5].forEach(function (n) { total += cont[n]; });
      $('stats-nac').innerHTML = [1, 2, 3, 4, 5].map(function (n) {
        return '<li class="stat-item"><div class="stat-num lv' + n + '">' + cont[n] + '</div><div class="stat-lbl">' + C.esc(C.LEVELS[n].nome) + '</div></li>';
      }).join('');
      $('stats-total').textContent = total + ' concelhos com dados do IPMA em ' + C.fmtLongo(data0) + '.';
    }

    /* última atualização */
    var at = $('atualizacao');
    if (d0) at.textContent = 'Dados do IPMA' + (d0.fileDate ? ' · atualizados em ' + C.fmtDataHora(d0.fileDate) : '') + ' · volta a verificar a cada 30 minutos.';
    else at.textContent = '';

    $('btn-limpar').hidden = !tem;

    /* anúncio para leitores de ecrã (só quando muda) */
    var sr = d0 && tem ? rotulo + ': perigo de incêndio ' + C.nivelTexto(rcm0) + ', ' + dataTxt + '.' : '';
    if (sr && sr !== ultimoSR) { $('estado-sr').textContent = sr; ultimoSR = sr; }
  }

  /* ── Dados ──────────────────────────────────────────────────── */
  async function carregar(silencioso) {
    if (!silencioso) { aviso('aviso-erro', null); $('aviso-erro').hidden = true; }
    try {
      var r = await Promise.all([C.fetchIPMA(0), C.fetchIPMA(1)]);
      S.d0 = r[0]; S.d1 = r[1];
      $('aviso-erro').hidden = true;
    } catch (e) {
      var html = S.d0
        ? 'Não foi possível atualizar os dados do IPMA. Estão a ser mostrados os últimos dados obtidos' + (S.d0.fileDate ? ' (' + C.esc(C.fmtDataHora(S.d0.fileDate)) + ')' : '') + '. Consulte <a href="https://www.ipma.pt/pt/riscoincendio/rcm.pt/" target="_blank" rel="noopener noreferrer">ipma.pt</a> para confirmar.'
        : 'Não foi possível obter os dados do IPMA. Verifique a ligação à Internet e tente novamente. Entretanto, consulte <a href="https://www.ipma.pt/pt/riscoincendio/rcm.pt/" target="_blank" rel="noopener noreferrer">ipma.pt</a>.<br><button type="button" class="btn btn--ghost" id="btn-repetir">Tentar novamente</button>';
      aviso('aviso-erro', html);
      var b = $('btn-repetir'); if (b) b.addEventListener('click', function () { carregar(false); });
    }
    render();
  }

  /* ── Escolha de localização ─────────────────────────────────── */
  function selecionar(dico, origem, mensagem) {
    S.dico = dico; S.origem = origem; guardar(dico);
    $('sugestoes').innerHTML = '';
    $('concelho-q').value = C.nomeConcelho(dico);
    msg(mensagem || '');
    render();
  }
  function pesquisar() {
    var texto = $('concelho-q').value, sug = $('sugestoes');
    sug.innerHTML = '';
    var r = C.procurar(texto, 6);
    if (!r.length) { msg('Concelho não encontrado. Verifique o nome (por exemplo: Santa Maria da Feira).', true); return; }
    var exato = C.dicoExato(texto);
    if (exato) { selecionar(exato, 'pesquisa'); return; }
    if (r.length === 1) { selecionar(r[0].dico, 'pesquisa'); return; }
    msg('Escolha o concelho pretendido:');
    sug.innerHTML = r.map(function (c) { return '<li><button type="button" data-dico="' + c.dico + '">' + C.esc(c.nome) + ' <span class="sr-only">(' + C.esc(C.nomeDistrito(c.dico)) + ')</span><span aria-hidden="true"> · ' + C.esc(C.nomeDistrito(c.dico)) + '</span></button></li>'; }).join('');
  }

  function haversine(a, b, c, d) {
    var R = 6371, p = Math.PI / 180, dl = (c - a) * p, dn = (d - b) * p;
    var x = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a * p) * Math.cos(c * p) * Math.sin(dn / 2) * Math.sin(dn / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  /* Estimativa por proximidade ao centro do concelho (coordenadas fornecidas pelo IPMA). */
  function maisProximo(lat, lon) {
    if (!S.d0) return null;
    var melhor = null, dmin = Infinity;
    TODOS.forEach(function (d) {
      var e = S.d0.local[d]; if (!e || e.latitude == null || e.longitude == null) return;
      var x = haversine(lat, lon, +e.latitude, +e.longitude); if (x < dmin) { dmin = x; melhor = d; }
    });
    return melhor;
  }
  /* Geocodificação inversa (Nominatim/OpenStreetMap). Coordenadas arredondadas a ~100 m. */
  async function nominatim(lat, lon) {
    var ctrl = new AbortController(), t = setTimeout(function () { ctrl.abort(); }, 8000);
    try {
      var url = 'https://nominatim.openstreetmap.org/reverse?lat=' + lat.toFixed(3) + '&lon=' + lon.toFixed(3) + '&format=jsonv2&accept-language=pt&zoom=10&addressdetails=1';
      var r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var a = (await r.json()).address || {};
      var cand = [a.municipality, a.city, a.town, a.village, a.county].filter(Boolean)
        .map(function (s) { return s.replace(/^(Município|Concelho)\s+de\s+/i, '').trim(); });
      for (var i = 0; i < cand.length; i++) { var d = C.dicoExato(cand[i]); if (d) return d; }
      return null;
    } finally { clearTimeout(t); }
  }
  function usarGPS() {
    var btn = $('btn-gps');
    if (!navigator.geolocation) { msg('O seu navegador não permite obter a localização. Pesquise o concelho.', true); return; }
    btn.disabled = true; msg('A obter a sua localização…');
    navigator.geolocation.getCurrentPosition(async function (pos) {
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      try {
        var d = null;
        try { d = await nominatim(lat, lon); } catch (e) { d = null; }
        if (d) selecionar(d, 'gps', 'Localização identificada: ' + C.nomeConcelho(d) + '. Não é este? Pesquise o seu concelho.');
        else {
          var p = maisProximo(lat, lon);
          if (p) selecionar(p, 'gps-aprox', 'Não foi possível confirmar o concelho. A mostrar o mais próximo (estimativa): ' + C.nomeConcelho(p) + '. Se não for o seu, pesquise-o.');
          else msg('Não foi possível identificar o concelho. Pesquise o seu concelho.', true);
        }
      } finally { btn.disabled = false; }
    }, function (err) {
      btn.disabled = false;
      msg(err && err.code === 1 ? 'Não foi dada permissão para aceder à localização. Pode pesquisar o seu concelho.' : 'Não foi possível obter a localização. Pode pesquisar o seu concelho.', true);
    }, { timeout: 10000, maximumAge: 300000 });
  }

  /* ── Arranque ───────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    C.initMenuDistritos(null);
    var dl = $('lista-concelhos');
    dl.innerHTML = C.CONCELHOS.map(function (c) { return '<option value="' + C.esc(c[1]) + '"></option>'; }).join('');

    $('pesquisa-form').addEventListener('submit', function (e) { e.preventDefault(); pesquisar(); });
    $('btn-gps').addEventListener('click', usarGPS);
    $('btn-limpar').addEventListener('click', function () {
      S.dico = null; S.origem = null; guardar(null); $('concelho-q').value = ''; $('sugestoes').innerHTML = ''; msg('Localização removida deste dispositivo.'); render(); $('concelho-q').focus();
    });
    $('sugestoes').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-dico]'); if (b) selecionar(b.dataset.dico, 'pesquisa');
    });

    var guardado = lerGuardado();
    if (guardado) { S.dico = guardado; S.origem = 'guardado'; $('concelho-q').value = C.nomeConcelho(guardado); }
    render();
    carregar(false);
    C.autoAtualizar(function () { carregar(true); });
  });
})(window);
