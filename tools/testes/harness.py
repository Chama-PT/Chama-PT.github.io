import json, datetime, re, subprocess, time, os, sys
from playwright.sync_api import sync_playwright
OUT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..'))
PORT=8099
OFF=[l.strip().split(' ',1) for l in open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'dico_oficial.txt'),encoding='utf-8')]
def coords(i):  # coordenadas fictícias determinísticas (só para testes)
    return 37+ (i*0.0173)%5.5, -9.4+ (i*0.0311)%2.8
def mock(day=0, overrides=None, omit=(), data_prev=None, file_date=None):
    hoje=datetime.date.today()+datetime.timedelta(days=day)
    local={}
    for i,(c,n) in enumerate(OFF):
        if c in omit: continue
        lat,lon=coords(i)
        lvl=(int(c)+day)%5+1
        if overrides and c in overrides: lvl=overrides[c][day] if isinstance(overrides[c],(list,tuple)) else overrides[c]
        local[c]={"data":{"rcm":lvl},"DICO":c,"latitude":round(lat,2),"longitude":round(lon,2)}
    return {"dataPrev":(data_prev or hoje.isoformat()) if day==0 else hoje.isoformat(),"dataRun":hoje.isoformat(),
            "fileDate":file_date or f"{datetime.date.today().isoformat()} 09:05:01","local":local}
def level(c,day=0,overrides=None):
    if overrides and c in overrides: return overrides[c][day] if isinstance(overrides[c],(list,tuple)) else overrides[c]
    return (int(c)+day)%5+1
def start_server():
    p=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'--directory',OUT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    time.sleep(1); return p
def setup(ctx, ipma=None, nominatim=None, fail_ipma=False, log=None):
    state={'ipma_calls':0,'nom_calls':[]}
    def on_ipma(route):
        state['ipma_calls']+=1
        if fail_ipma(state) if callable(fail_ipma) else fail_ipma: route.abort(); return
        day=int(re.search(r'rcm-d(\d)',route.request.url).group(1))
        data=ipma(day) if callable(ipma) else mock(day)
        route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(data))
    def on_nom(route):
        state['nom_calls'].append(route.request.url)
        resp=nominatim if nominatim is not None else {"address":{"municipality":"Sintra","state":"Lisboa"}}
        route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(resp))
    ctx.route('https://api.ipma.pt/**',on_ipma)
    ctx.route('https://nominatim.openstreetmap.org/**',on_nom)
    ctx.route(re.compile(r'https://fonts\.(googleapis|gstatic)\.com/.*'),lambda r:r.fulfill(status=200,content_type='text/css',body=''))
    return state
def watch(page, errs):
    page.on('console',lambda m: errs.append(('console.'+m.type,m.text)) if m.type in('error','warning') else None)
    page.on('pageerror',lambda e: errs.append(('pageerror',str(e))))
    page.on('requestfailed',lambda r: errs.append(('requestfailed',r.url)) if 'localhost' in r.url else None)
