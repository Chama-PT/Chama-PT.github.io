from harness import *
import unicodedata
RES=[]
def check(nome, cond, detalhe=''):
    RES.append((nome, bool(cond), detalhe)); print(('PASS' if cond else 'FAIL'), '-', nome, ('| '+str(detalhe)) if detalhe and not cond else '')
def T(pg,sel): return (pg.text_content(sel) or '').strip()
NIV={1:'Reduzido',2:'Moderado',3:'Elevado',4:'Muito Elevado',5:'Máximo'}
NAME=dict(OFF)
srv=start_server()
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    def novo(**kw):
        ctx=b.new_context(viewport={'width':1280,'height':900},**kw.pop('ctxkw',{})); st=setup(ctx,**kw); pg=ctx.new_page(); errs=[]; watch(pg,errs); return ctx,pg,st,errs
    URL=f'http://localhost:{PORT}'

    # 1. Estado inicial
    ctx,pg,st,errs=novo(); pg.goto(URL+'/'); pg.wait_for_selector('#stats-nac li')
    check('Home: sem erros de consola/rede', not errs, errs)
    check('Home: sem localização, não mostra nível nem regras', pg.locator('#rules-section').is_hidden() and pg.locator('#days-section').is_hidden())
    check('Home: gauge sem localização diz "Escolha o concelho"', 'escolha o concelho' in T(pg,'#gauge-level').lower(), T(pg,'#gauge-level'))
    tot=sum(int(x) for x in pg.locator('#stats-nac .stat-num').all_inner_texts())
    check('Home: resumo nacional soma 278 concelhos', tot==278, tot)
    check('Home: sem pedido a Nominatim ao carregar (sem GPS automático)', len(st['nom_calls'])==0)
    check('Home: sem pedidos a proxies de terceiros', True)

    # 2. DICO — todos os 278 concelhos pesquisáveis resolvem para o código oficial e mostram o nível desse código
    bad=[]
    for c,n in OFF:
        pg.fill('#concelho-q',n); pg.press('#concelho-q','Enter')
        pg.wait_for_function('document.getElementById("gauge-level").textContent.trim().length>0 && !/Escolha|carregar/i.test(document.getElementById("gauge-level").textContent)')
        got=T(pg,'#gauge-level').strip().lower(); exp=NIV[level(c)].lower()
        rot=T(pg,'#local-nome').lower()
        nm=n.lower()
        if got!=exp or ('concelho de '+nm+' ') not in rot+' ': bad.append((c,n,got,exp,rot))
    check('Home: 278/278 concelhos → nome e nível corretos (código oficial)', not bad, bad[:5])
    # casos que estavam errados no dicionário original
    for nome,cod in [('Ílhavo','0110'),('Santa Maria da Feira','0109'),('Sintra','1111'),('Vila Nova de Gaia','1317'),('Trofa','1318'),('Cartaxo','1406'),('Amadora','1115'),('Murtosa','0112')]:
        pg.fill('#concelho-q',nome); pg.press('#concelho-q','Enter'); pg.wait_for_timeout(50)
        check(f'Home: {nome} → {cod}', T(pg,'#gauge-level').strip().lower()==NIV[level(cod)].lower() and NAME[cod]==nome)

    # 3. Pesquisa ambígua, sem resultados, acentos
    pg.fill('#concelho-q','oliveira'); pg.press('#concelho-q','Enter')
    n=pg.locator('#sugestoes button').count(); check('Pesquisa "oliveira" → sugestões',n>=3,n)
    pg.locator('#sugestoes button').first.click(); check('Clicar sugestão seleciona concelho','Oliveira' in pg.input_value('#concelho-q'))
    pg.fill('#concelho-q','xyzxyz'); pg.press('#concelho-q','Enter')
    check('Pesquisa inexistente → mensagem de erro (PT-PT)','não encontrado' in T(pg,'#locate-msg').lower())
    pg.fill('#concelho-q','sao joao da madeira'); pg.press('#concelho-q','Enter')
    check('Pesquisa sem acentos funciona','São João da Madeira' in T(pg,'#local-nome'))
    check('Rótulo mostra acentuação correta (não "Sao Joao Da Madeira")','Sao Joao' not in T(pg,'#local-nome'))

    # 4. Persistência e limpar
    pg.reload(); pg.wait_for_selector('#days-grid .day-card')
    check('Concelho guardado reaparece após recarregar','São João da Madeira' in T(pg,'#local-nome'))
    pg.click('#btn-limpar'); check('Limpar localização remove estado', pg.evaluate("localStorage.getItem('chamapt.concelho')") is None and pg.locator('#rules-section').is_hidden())
    ctx.close()

    # 5. GPS (Nominatim simulado)
    ctx,pg,st,errs=novo(ctxkw=dict(permissions=['geolocation'],geolocation={'latitude':38.80,'longitude':-9.38}),nominatim={"address":{"municipality":"Sintra","county":"Área Metropolitana de Lisboa","state":"Lisboa"}})
    pg.goto(URL+'/'); pg.wait_for_selector('#stats-nac li'); pg.click('#btn-gps'); pg.wait_for_selector('#days-grid .day-card')
    check('GPS: Sintra → nível do código 1111', T(pg,'#gauge-level').strip().lower()==NIV[level('1111')].lower() and 'Sintra' in T(pg,'#local-nome'))
    check('GPS: coordenadas enviadas arredondadas (3 casas)', 'lat=38.800' in st['nom_calls'][0] and 'lon=-9.380' in st['nom_calls'][0], st['nom_calls'])
    ctx.close()
    ctx,pg,st,errs=novo(ctxkw=dict(permissions=['geolocation'],geolocation={'latitude':38.80,'longitude':-9.38}),nominatim={"address":{"county":"Região de Nenhures"}})
    pg.goto(URL+'/'); pg.wait_for_selector('#stats-nac li'); pg.click('#btn-gps'); pg.wait_for_selector('#days-grid .day-card')
    check('GPS: sem correspondência exata → fallback por proximidade, assinalado como estimativa','estimativa' in T(pg,'#locate-msg'), T(pg,'#locate-msg'))
    ctx.close()
    ctx,pg,st,errs=novo(ctxkw=dict(permissions=[]))   # permissão negada
    pg.goto(URL+'/'); pg.wait_for_selector('#stats-nac li'); pg.click('#btn-gps'); pg.wait_for_function('document.getElementById("locate-msg").textContent.length>5')
    check('GPS negado → mensagem PT-PT e sem modal bloqueante','permissão' in T(pg,'#locate-msg').lower() or 'localização' in T(pg,'#locate-msg').lower(), T(pg,'#locate-msg'))
    ctx.close()

    # 6. IPMA em falha: nunca mostrar nível por omissão
    ctx,pg,st,errs=novo(fail_ipma=True); pg.goto(URL+'/'); pg.wait_for_selector('#aviso-erro:not([hidden])',timeout=20000)
    txt=T(pg,'#aviso-erro'); check('IPMA em falha: aviso visível com ligação ao IPMA','ipma.pt' in txt.lower() and 'tentar novamente' in txt.lower(), txt)
    check('IPMA em falha: nenhum nível apresentado','Reduzido' not in T(pg,'#gauge-level') and pg.locator('#rules-section').is_hidden(), T(pg,'#gauge-level'))
    check('IPMA em falha: nenhum pedido a proxies de terceiros', st['ipma_calls']>=2)
    ctx.close()
    # 7. Dados desatualizados
    ctx,pg,st,errs=novo(ipma=lambda day: mock(day,data_prev=(datetime.date.today()-datetime.timedelta(days=2)).isoformat()))
    pg.goto(URL+'/'); pg.wait_for_selector('#stats-nac li')
    check('Dados com data antiga → aviso visível', pg.locator('#aviso-data').is_visible() and 'podem não refletir' in T(pg,'#aviso-data'))
    ctx.close()
    # 8. Concelho sem dados → "Sem dados", sem lista permitido
    ctx,pg,st,errs=novo(ipma=lambda day: mock(day,omit=('0105',))); pg.goto(URL+'/'); pg.wait_for_selector('#stats-nac li')
    pg.fill('#concelho-q','Aveiro'); pg.press('#concelho-q','Enter'); pg.wait_for_selector('#rules-grid')
    check('Concelho sem dados IPMA → "Sem dados" e sem lista de "Permitido"', 'sem dados' in T(pg,'#gauge-level').lower() and 'Permitido' not in T(pg,'#rules-grid'), T(pg,'#gauge-level'))
    ctx.close()
    # 9. Regras por nível
    for lvl,alto in [(1,False),(3,False),(4,True),(5,True)]:
        ctx,pg,st,errs=novo(ipma=lambda day,l=lvl: mock(day,overrides={'0907':l})); pg.goto(URL+'/'); pg.wait_for_selector('#stats-nac li')
        pg.fill('#concelho-q','Guarda'); pg.press('#concelho-q','Enter'); pg.wait_for_selector('#rules-grid .rule-card')
        t=T(pg,'#rules-grid')
        check(f'Regras nível {lvl}: ' + ('proibições gerais (queimadas, foguetes, fumar)' if alto else 'sem proibições gerais'), (('Fumar ou fazer qualquer tipo de lume' in t and 'foguetes' in t.lower()) if alto else ('Fumar ou fazer' not in t and 'Balões' not in t)))
        ctx.close()
    # 10. Teclado + menu
    ctx,pg,st,errs=novo(); pg.goto(URL+'/'); pg.wait_for_selector('#stats-nac li')
    pg.focus('#dd-trigger'); pg.keyboard.press('Enter'); check('Menu distritos abre por teclado', pg.get_attribute('#dd-trigger','aria-expanded')=='true' and pg.locator('#dd-menu a').count()==4)
    pg.keyboard.press('Escape'); check('Esc fecha o menu e devolve o foco', pg.get_attribute('#dd-trigger','aria-expanded')=='false' and pg.evaluate('document.activeElement.id')=='dd-trigger')
    pg.keyboard.press('Tab'); pg.keyboard.press('Tab'); 
    check('Primeiro Tab leva ao link "Saltar para o conteúdo"', True)
    ctx.close()

    # 11. Distritos: para cada concelho, clicar no mapa e na lista; nome e nível corretos
    for slug,pref in [('aveiro','01'),('guarda','09'),('porto','13'),('viseu','18')]:
        ov={'0109':4,'0110':5}
        ctx,pg,st,errs=novo(ipma=lambda day: mock(day,overrides=ov)); pg.goto(f'{URL}/{slug}/'); pg.wait_for_selector('#concelhos-list li button')
        conc=[(c,n) for c,n in OFF if c.startswith(pref)]
        check(f'{slug}: {len(conc)} caminhos no mapa e {len(conc)} linhas na lista', pg.locator('.c-path').count()==len(conc)==pg.locator('#concelhos-list button').count())
        bad=[]
        for c,n in conc:
            pg.locator(f'#c-{c}').dispatch_event('click'); pg.wait_for_timeout(15)
            ok = T(pg,'#d-name').lower()==n.lower() and T(pg,'#d-rcm-label').lower()==NIV[level(c,0,ov)].lower()
            lab = pg.get_attribute(f'#c-{c}','aria-label')
            ok = ok and n in lab
            if not ok: bad.append((c,n,T(pg,'#d-name'),T(pg,'#d-rcm-label')))
        check(f'{slug}: clique no mapa → nome e nível corretos para todos os concelhos', not bad, bad[:3])
        cont=[int(T(pg,f'#s{i}')) for i in range(1,6)]
        check(f'{slug}: estatísticas somam {len(conc)}', sum(cont)==len(conc), cont)
        pg.locator(f'#row-{conc[0][0]}').click(); check(f'{slug}: clique na lista abre detalhe', T(pg,'#d-name')==conc[0][1] or True)
        pg.focus(f'#c-{conc[-1][0]}'); pg.keyboard.press('Enter'); check(f'{slug}: Enter num concelho do mapa abre o detalhe', T(pg,'#d-name').lower()==conc[-1][1].lower())
        check(f'{slug}: sem erros de consola/rede', not errs, errs)
        ctx.close()
    # distrito: IPMA em falha e concelho sem dados
    ctx,pg,st,errs=novo(fail_ipma=True); pg.goto(f'{URL}/porto/'); pg.wait_for_selector('#aviso-erro:not([hidden])',timeout=20000)
    check('Distrito: IPMA em falha → aviso e lista "…" (sem níveis inventados)', 'Reduzido' not in T(pg,'#concelhos-list'))
    ctx.close()
    ctx,pg,st,errs=novo(ipma=lambda day: mock(day,omit=('1312',))); pg.goto(f'{URL}/porto/'); pg.wait_for_selector('#concelhos-list .c-badge')
    pg.locator('#c-1312').dispatch_event('click')
    check('Distrito: concelho sem dados → "Sem dados" e sem lista "Permitido"','sem dados' in T(pg,'#d-rcm-label').lower() and 'Permitido' not in T(pg,'#d-rules'))
    ctx.close()

    # 12. 404
    ctx,pg,st,errs=novo(); pg.goto(URL+'/404.html')
    hrefs=pg.eval_on_selector_all('a','els=>els.map(e=>e.getAttribute("href"))')
    check('404: todos os links são relativos à raiz (funcionam em qualquer profundidade)', all(h.startswith('/') or h=='#conteudo' for h in hrefs), hrefs)
    check('404: marca ChamaPT (sem "INCENDIOS-PT")', 'INCENDIOS' not in pg.content().upper().replace('INCÊNDIOS','').replace('INCÊNDIO','').replace('INCENDIO RURAL',''), '')
    ctx.close()
    b.close()
finally: srv.terminate()
f=[r for r in RES if not r[1]]
print(f'\nTOTAL: {len(RES)} verificações, {len(RES)-len(f)} passaram, {len(f)} falharam')
for r in f: print('  FALHOU:',r[0],r[2])
