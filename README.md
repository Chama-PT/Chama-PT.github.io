# 🇵🇹 ChamaPT — Risco de Incêndio Rural em Portugal

[Licença: MIT](LICENSE) · [Dados: IPMA](https://api.ipma.pt/)

O **ChamaPT** é um projeto de código aberto, independente e gratuito que permite consultar o nível de perigo de incêndio rural de hoje em Portugal Continental, por concelho e distrito, e perceber as condicionantes associadas a cada nível.

🔗 **Aplicação:** [chama-pt.github.io](https://chama-pt.github.io)

> **Aviso:** o ChamaPT não é um serviço oficial nem está associado ao IPMA, ao ICNF ou à Proteção Civil. A informação é um apoio e não substitui a legislação em vigor nem as indicações da câmara municipal e das autoridades. Em caso de incêndio, ligue **112**.

---

## Funcionalidades

* 🔍 **Pesquisa de concelho** (278 concelhos de Portugal Continental), com ou sem acentos.
* 📍 **Localização, só quando o utilizador pede:** o botão «Usar a minha localização» identifica o concelho. Ver [Privacidade](#privacidade).
* 📊 **Escala de perigo do IPMA:** Reduzido, Moderado, Elevado, Muito Elevado e Máximo.
* 🔮 **Previsão** para hoje e amanhã, com a data indicada pelo próprio IPMA e aviso quando os dados não são de hoje.
* 🚫 **Condicionantes por nível**, resumidas a partir da informação do ICNF (Decreto-Lei n.º 82/2021).
* 🗺️ **Mapas por distrito** (Aveiro, Guarda, Porto e Viseu), navegáveis por rato, toque e teclado.
* ♿ Navegável por teclado, com marcação semântica para leitores de ecrã; respeita `prefers-reduced-motion`.

Se os dados do IPMA não estiverem disponíveis, o site **não apresenta nenhum nível** — mostra um aviso e a ligação para o IPMA.

---

## Estrutura do projeto

```
index.html              Página principal
aveiro/ guarda/ porto/ viseu/   Páginas de distrito (mapa SVG + lista + detalhe)
404.html                Página de erro (noindex)
assets/css/chama.css    Estilos partilhados
assets/js/concelhos.js  Lista oficial de concelhos (código DICO ↔ nome)
assets/js/core.js       Níveis, condicionantes, acesso ao IPMA, utilitários
assets/js/home.js       Lógica da página principal
assets/js/distrito.js   Lógica das páginas de distrito
assets/img/             Ícones e imagem de partilha (1200×630)
tools/testes/           Testes automáticos (Playwright) e verificações estáticas
sitemap.xml, robots.txt
```

Site 100 % estático, sem passo de compilação, pronto para o **GitHub Pages**.

### Executar localmente

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

---

## Manutenção

### Condicionantes (muito importante)
As listas «Proibido / Permitido» estão em `assets/js/core.js` (`BAIXO` e `ALTO`) e resumem o documento do ICNF
[«Restrições associadas ao perigo de incêndio rural diário»](https://fogos.icnf.pt/SGIF2010/InformacaoPublicaDados/Condicionantes_PerigoIncendiosRural.pdf).
**Reveja-as sempre que a legislação mudar** e, pelo menos, antes de cada época de incêndios.

### Códigos dos concelhos
Os códigos em `assets/js/concelhos.js` são os códigos **DICO oficiais** (os mesmos usados pelo IPMA). Não os ordene alfabeticamente:
concelhos mais recentes têm códigos fora de ordem (ex.: Amadora `1115`, Odivelas `1116`, Trofa `1318`, Ourém `1421`).

### Adicionar um distrito
1. Copiar uma página de distrito existente (ex.: `porto/index.html`) para `novo-distrito/index.html`.
2. Alterar `data-distrito`, `data-prefixo` (2 primeiros dígitos do DICO) e `data-nome` no `<body>`, o `title`, a `description`, o canonical, o JSON-LD e a FAQ.
3. Substituir o `<svg>` pelo mapa do novo distrito; cada `<path>` deve ter `id="c-CODIGODICO"` e `class="c-path"`.
4. Acrescentar o distrito em `DISTRITOS_COM_PAGINA` (`assets/js/core.js`), no rodapé e no `sitemap.xml`.

### Testes
```bash
pip install playwright lxml && playwright install chromium
python3 tools/testes/test_func.py      # testes no navegador (IPMA e Nominatim simulados)
python3 tools/testes/static_audit.py   # HTML, SEO, links, JSON-LD
```

---

## Fontes de dados

1. **IPMA** — nível diário de perigo de incêndio rural por concelho (`api.ipma.pt/open-data`), obtido diretamente no navegador do utilizador.
2. **ICNF** — resumo das condicionantes por nível de perigo (documento público, ligado nas páginas).
3. **OpenStreetMap / Nominatim** — apenas se o utilizador usar a localização, para identificar o concelho.

## Privacidade

* Sem cookies de rastreio nem ferramentas de análise.
* **«Usar a minha localização»:** o navegador pede autorização e, se aceitar, as coordenadas **aproximadas (arredondadas a ~100 m)** são enviadas ao serviço Nominatim (OpenStreetMap) para identificar o concelho. O ChamaPT não as guarda. Se o Nominatim falhar, o concelho é estimado localmente, sem enviar dados.
* O concelho escolhido fica guardado **apenas no dispositivo** (armazenamento local), até ser limpo com «Limpar localização».
* As letras são carregadas do Google Fonts (que recebe o endereço IP do visitante). Alojar as fontes no próprio site elimina esta ligação.

## Licença

Licença MIT — ver [LICENSE](LICENSE).
