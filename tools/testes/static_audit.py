import re, json, os, glob, html
from lxml import html as LH
OUT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')); BASE='https://chama-pt.github.io'
pages=['index.html','404.html','aveiro/index.html','guarda/index.html','porto/index.html','viseu/index.html']
problems=[]
def P(m): problems.append(m); print('  ✗',m)
titles=set(); descs=set()
for pg in pages:
    src=open(f'{OUT}/{pg}',encoding='utf-8').read(); doc=LH.fromstring(src)
    print('==',pg,f'({len(src)/1024:.1f} KB)')
    ids=[e.get('id') for e in doc.xpath('//*[@id]')]
    d=[i for i in set(ids) if ids.count(i)>1]; 
    if d: P(f'IDs duplicados: {d}')
    t=doc.xpath('//head/title/text()'); m=doc.xpath('//meta[@name="description"]/@content')
    if len(t)!=1: P('title em falta/duplicado')
    else:
        print('   title:',len(t[0]),'car.:',t[0]); 
        if t[0] in titles: P('title repetido')
        titles.add(t[0])
        if len(t[0])>65: P('title >65 caracteres')
    if len(m)!=1: P('meta description em falta')
    else:
        print('   description:',len(m[0]),'car.')
        if m[0] in descs: P('description repetida')
        descs.add(m[0]); 
        if pg!='404.html' and not 70<=len(m[0])<=165: P(f'description fora do intervalo recomendado ({len(m[0])})')
    h1=doc.xpath('//h1'); 
    if len(h1)!=1: P(f'{len(h1)} elementos h1')
    # hierarquia de títulos
    lv=[int(e.tag[1]) for e in doc.xpath('//h1|//h2|//h3|//h4')]
    for a,b in zip(lv,lv[1:]):
        if b>a+1: P(f'salto de nível de título h{a}→h{b}')
    if doc.get('lang')!='pt-PT': P('lang != pt-PT')
    if not doc.xpath('//main'): P('sem <main>')
    if len(doc.xpath('//main'))!=1: P('mais de um <main>')
    # tudo o que é conteúdo está dentro de landmarks? (h1 dentro de main)
    if not doc.xpath('//main//h1'): P('h1 fora de <main>')
    can=doc.xpath('//link[@rel="canonical"]/@href')
    if pg!='404.html':
        exp=BASE+'/'+pg.replace('index.html','')
        if can!=[exp]: P(f'canonical {can} != {exp}')
    else:
        if not doc.xpath('//meta[@name="robots"][contains(@content,"noindex")]'): P('404 sem noindex')
    # inputs com label; botões com nome
    for i in doc.xpath('//input[not(@type="hidden")]'):
        iid=i.get('id'); 
        if not (iid and doc.xpath(f'//label[@for="{iid}"]')) and not i.get('aria-label'): P(f'input sem label: {iid}')
    for b in doc.xpath('//button'):
        if not (b.text_content().strip() or b.get('aria-label')): P(f'botão sem nome: {b.get("id")}')
    for a in doc.xpath('//a[@target="_blank"]'):
        if 'noopener' not in (a.get('rel') or ''): P(f'link externo sem rel=noopener: {a.get("href")}')
    for a in doc.xpath('//a[not(normalize-space(.)) and not(@aria-label)]'): P('link sem texto/nome')
    for im in doc.xpath('//img[not(@alt)]'): P('img sem alt')
    # recursos locais existem
    for u in doc.xpath('//link/@href|//script/@src|//a/@href'):
        if u.startswith('/') and not u.startswith('//'):
            path=u.split('#')[0].split('?')[0]
            f=OUT+path+('index.html' if path.endswith('/') else '')
            if not os.path.exists(f): P(f'recurso/link local inexistente: {u}')
    # JSON-LD
    for s in doc.xpath('//script[@type="application/ld+json"]/text()'):
        try:
            j=json.loads(s); types=[x.get('@type') for x in j['@graph']]; print('   JSON-LD OK:',types)
            faq=[x for x in j['@graph'] if x.get('@type')=='FAQPage']
            vis=[h.text_content().strip() for h in doc.xpath('//div[@class="faq"]/h3')]
            if faq:
                names=[q['name'] for q in faq[0]['mainEntity']]
                if names!=vis: P('FAQ JSON-LD não coincide com o texto visível')
        except Exception as e: P(f'JSON-LD inválido: {e}')
    if 'itemscope' in src or 'itemprop' in src: P('microdados duplicados presentes')
    # texto inglês/brasileirismos/tratamento informal
    txt=doc.text_content()
    for w in ['Oops','tu ','Introduz','Utiliza ','Perdeste','tempo real','Tempo Real','6ª','Sao ','Carregar...']:
        if w in txt: P(f'expressão suspeita no texto: "{w}"')
# sitemap vs canónicos
sm=re.findall(r'<loc>([^<]+)</loc>',open(f'{OUT}/sitemap.xml').read())
can={BASE+'/'+p.replace('index.html','') for p in pages if p!='404.html'}
print('\nsitemap:',sm); 
if set(sm)!=can: P('sitemap != canónicos')
print('robots:',open(f'{OUT}/robots.txt').read().replace('\n',' | '))
# JS/CSS: nenhuma referência a proxies de terceiros / ICO hotlink
for f in glob.glob(OUT+'/**/*.*',recursive=True):
    if f.endswith(('.html','.js','.css')) and '/tools/' not in f:
        s=open(f,encoding='utf-8').read()
        for bad in ['corsproxy','allorigins','cloudinary','bupi.gov.pt','ICNF e IPMA','ICNF / IPMA']:
            if bad in s: P(f'{os.path.relpath(f,OUT)}: contém "{bad}"')
print('\nPROBLEMAS:',len(problems))
