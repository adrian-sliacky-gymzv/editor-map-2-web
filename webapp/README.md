# Editor máp 2 — kompletná webová verzia

Nekomerčná, mobilná webová reimplementácia pôvodnej aplikácie **Editor máp 2**
(2010). Neobsahuje len Slovensko: obsahuje **všetkých 8 pôvodných máp**, všetky
testy a obtiažnosti z `config.xml`, obe pôvodné databázy `.mef`, všetkých
**1 982 geografických objektov** a **plnohodnotný editor máp** s vrstvami,
farbami, značkami, kreslením, ukladaním, exportom a tlačou.

Ako bonus zostal zachovaný aj moderný **atlas 74 slovenských miest** s hľadaním,
filtrami, štatistikami a rýchlym tréningom.

![Domovská obrazovka webovej verzie](screenshot-home.png)

![Editor máp s pôvodnou mapou Európy](screenshot-editor.png)

## Čo je súčasťou

### Pôvodné aktivity

- **Vyskúšaj sa!** — všetkých 8 máp a všetky testy z `config.xml`.
  Na mape sa zobrazí 3, 5 alebo 7 kandidátov; jeden patrí zadanému objektu.
  Otázky sa ťahajú z pôvodných testovacích skupín a filtrujú sa podľa
  `testLevel`. Bodovanie je podiel správnych odpovedí.
- **Traf sa!** — 7 pôvodných máp (config pre túto aktivitu neobsahuje
  Austráliu). Presná pôvodná bodová formula, prahy spätnej väzby, červený tip
  a zelená správna poloha. Funguje na všetkých mapách vrátane sveta, Afriky,
  Ázie, Európy a oboch Amerík.
- **Poskladaj!** — 7 pôvodných máp (config pre túto aktivitu neobsahuje
  Slovensko). Objekt sa zobrazí v strede mapy, treba ho presunúť na správne
  miesto. Tolerancia je **15 mapových jednotiek**, presne ako v origináli.
  Objekt možno chytiť priamo za tvar alebo za neviditeľný väčší chytací kruh.

Všetky aktivity majú pôvodné texty, testy, obtiažnosti, počty možností,
časovač a výsledkové hlášky. Výsledky sa navyše zobrazujú v prehľadnej karte
so zoznamom objektov a dajú sa zdieľať.

### Plnohodnotný editor máp

- **Nová / Otvoriť / Ulož / Ulož ako** pre pôvodné `.mef` súbory.
  Podľa podpory prehliadača používa File System Access API (skutočné
  prepisovanie súboru) alebo bezpečný download/picker.
- **Strom všetkých objektov** s rozbaľovaním, hľadaním, počtom objektov
  a stavmi `visible / hidden / any`.
- **Viditeľnosť objektov a značiek** pre celé vetvy aj jednotlivé objekty,
  s automatickým prepočtom stavu rodičov.
- **Farby** podľa pôvodnej palety 32 farieb (a transparentnej varianty) plus
  vlastný color picker. Rešpektuje pôvodné režimy `replaceColor`, `colorAdd`
  a `overrideColor` vrátane špeciálneho `0x010101`.
- **Vlastné značky** — pridanie do ľubovoľnej vetvy, presúvanie, premenovanie,
  skrytie a odstránenie. Značky sa ukladajú do `.mef`.
- **Kreslenie** — čiara, obdĺžnik, elipsa a voľná čiara, farba, hrúbka 0–4,
  výplň, mazanie poslednej kresby a ukladanie do `drawinglist`.
- **Zoom, posun, prispôsobenie**, koliesko myši, pinch-to-zoom, dotykové
  ovládanie a strom v mobilnom slide-over paneli.
- **Export PNG/JPEG** v nízkej/strednej/vysokej kvalite, celá mapa alebo
  aktuálne zobrazenie, s voliteľným vodoznakom.
- **Tlač** pripravená pre tlačiareň alebo uloženie do PDF.
- **Pomocník a O aplikácii** s pôvodnými autormi a licenčnými informáciami.
- **Klávesové skratky**: `Ctrl+S` uložiť, `Ctrl+Shift+S` uložiť ako,
  `Ctrl+O` otvoriť, `Ctrl+N` nová mapa, `Esc` zatvoriť panel, `0` prispôsobiť.

Editor je oddelený od aktivít: aktivity vždy používajú čistú kópiu predvolených
`.mef` dát, presne ako pôvodný `Fileman.getNewMapData`. Rozpracovaný dokument
editora sa tak nikdy nepremietne do hier.

### Bonus: atlas slovenských miest

- všetkých 74 miest s pôvodnými súradnicami, názvami a `testLevel`,
- hľadanie bez diakritiky, kumulatívne filtre obtiažnosti,
- výber mesta na mape aj v zozname,
- tréning jedného mesta alebo celého filtrovaného zoznamu,
- CSV export, lokálne štatistiky a zdieľanie výsledku.

## Spustenie

Potrebuješ len Node.js 18+ — žiadne závislosti, žiadny `npm install`.

```bash
cd webapp
npm start
# alebo: node server.mjs
```

Otvor <http://localhost:8124/>. Server štandardne počúva na `0.0.0.0`, takže
aplikáciu otvoríš aj z telefónu na rovnakej Wi-Fi; adresu vypíše do konzoly.

> Aplikáciu nespúšťaj cez `file://` — ES moduly, fetch a SVG scény vyžadujú
> HTTP server.

### GitHub Pages

Repozitár obsahuje hotový workflow `.github/workflows/pages.yml`, ktorý
publikuje obsah priečinka `webapp/` ako statickú stránku:

1. V GitHub repozitári otvor **Settings → Pages**.
2. Ako **Source** vyber **GitHub Actions**.
3. Pushni do vetvy `master` alebo `main`; workflow `Deploy to GitHub Pages`
   nahrá `webapp/` a zverejní ho.

Všetky cesty sú relatívne, `manifest.webmanifest` používa `start_url: "./"`,
priečinok obsahuje `.nojekyll` a `404.html`. Aplikácia preto funguje aj pod
repozitárovou podcestou, napríklad
`https://používateľ.github.io/Editor_map_GEG/`. Overené aj servovaním z
`/Editor_map_GEG/webapp/`: všetky CSS, JS, dáta, mapy, manifest aj pomoc sa
načítajú s HTTP 200 a hry fungujú. GitHub Pages nepotrebuje `server.mjs`.

## Ako hrať

### Vyskúšaj sa!

Vyber mapu, testovací okruh a obtiažnosť. Na mape sa zobrazí skupina značiek;
klikni na tú, ktorá patrí zadanému objektu. Po odpovedi sa správna značka
označí zelenou a nesprávne kliknutá červenou. Počet otázok je obmedzený počtom
dostupných objektov v zvolenom teste.

### Traf sa!

Ťukni alebo klikni na mapu tam, kde si myslíš, že objekt leží. Ihneď sa zobrazí
červený tip, zelená správna poloha, spojnica a oba názvy. Body sa počítajú
pôvodnou formulou; skóre pod 5 bodov sa mení na 0. Hra nevyžaduje potvrdenie
tipu, takže tok zostáva rýchly; náhodné odpovede pri pinchi alebo posune
zachytáva gestový filter.

### Poskladaj!

Objekt sa zobrazí v strede mapy. Pretiahni ho na miesto, kam patrí (alebo
chytíš jeho väčší neviditeľný chytací kruh). Ak je vzdialenosť od správnej
polohy menšia ako 15 jednotiek mapy, získaš bod.

### Editor

Editor otvoríš z domovskej karty **Editor máp**. Predvolene sa načíta posledná
mapa; cez **Nová** vyberieš inú z ôsmich máp. Vľavo je strom objektov, vpravo
mapa. Kliknutím na oko meníš viditeľnosť, na pin viditeľnosť značky, na farebný
štvorec farbu. Tlačidlom **+** pridáš vlastnú značku. Kreslenie zapneš tlačidlom
**Kreslenie**.

## Ovládanie a gestá

Mapy sa ovládajú rovnako v hrách aj v editore:

- **Jeden prst / ťahanie myšou** posúva mapu, keď je priblížená. Pri mierke
  „celá mapa“ sa mapa neposúva, takže sa nič nehýbe omylom.
- **Dva prsty** plynulo približujú a zároveň posúvajú mapu. Zoom je ukotvený
  na stred medzi prstami, takže obsah pod prstami neujíde.
- **Dvojité ťuknutie alebo dvojklik** priblíži mapu na približne 2,4× v mieste
  dotyku. Druhé dvojité ťuknutie vráti celú mapu.
- **Koliesko myši / trackpad** zoomuje plynulo okolo kurzora; `Ctrl` + koliesko
  (pinch na trackpade) pracuje rovnako.
- **Tlačidlá + / − / domov** a zobrazené percento sú vždy poruke. Na telefóne
  majú 46 px a sú v jednom rade, aby neprekážali.
- **Klávesy** `+`, `−` a `0` fungujú v hre aj v editore.
- Po pinchi, posune alebo dvojitom ťuknutí sa koncový dotyk **nikdy
  nevyhodnotí ako odpoveď**. Ťuknutie na ovládací prvok mapy tiež nikdy
  neodpovedá. Pri testovacích značkách musí byť dotyk skutočný tap, nie
  potiahnutie.
- Každá nová otázka začne na celom výreze mapy; pri „Traf sa!“ sa výsledok
  automaticky oddiali, ak by tip alebo správna poloha boli mimo obrazovky.

Pri hrách sa po odpovedi na telefóne objaví plávajúce tlačidlo **Ďalej** nad
ovládaním mapy, takže sa nemusíš naťahovať na hornú lištu.

## Bodovanie a pravidlá

### Traf sa! — presne ako originál

Pôvodná trieda `mxm.exam.DistanceTest` počíta body takto:

```text
maxDist = sqrt(šírka² + výška²)
dist    = round(vzdialenosť tipu od správneho markX/markY)
score   = round((maxDist - 3 * dist) / maxDist * 100)
score   = score < 5 ? 0 : score
úspešnosť = round(súčet bodov / počet otázok)
```

### Vyskúšaj sa! a Poskladaj!

```text
Vyskúšaj sa!: úspešnosť = round(správne / počet otázok * 100)
Poskladaj!:   úspešnosť = round(správne / (správne + nesprávne) * 100)
```

Testovacie skupiny sa vyberajú postupne, objekt v rámci skupiny sa neopakuje,
kým sa skupina nevyčerpá. Prázdne skupiny (napr. CHKO na ľahkej obtiažnosti)
sa preskakujú presne ako v pôvodnom `Test.getNextGroup`.

## Dátová vernosť

- `data/config.xml` a všetkých 8 súborov `data/maps/*.mef` sú prevzaté
  z pôvodnej distribučnej verzie. V `config.xml` je opravená len chybná XML
  deklarácia `<?xmlversion` na `<?xml version`, aby súbor akceptoval štandardný
  prehliadačový parser.
- Všetkých **1 982** objektov má rovnaké názvy, `entity`, `label`, `markX`,
  `markY`, `markLabel`, `markSymbol`, `testLevel`, `nopuzzle`, farby a
  viditeľnosť ako v `.mef`.
- Mapové scény v `assets/maps/*.svg` sú vygenerované z pôvodných vektorových
  knižníc `software/mapObjects/*.swf` (cez XML `PlaceObject2Tag` a SVG tvary).
  Každá scéna obsahuje presne tie isté pomenované objekty ako príslušný `.mef`.
- Pôvodné režimy farieb sú zachované:
  - `fillColor` → nahradenie pôvodnej výplne farbou objektu, obrysy zostávajú,
  - `colorAdd` → aditívne zafarbenie (čierne obrysy dostanú farbu, biele plochy
    zostanú svetlé),
  - ostatné objekty → plná farba objektu,
  - `0x010101` → pôvodný špeciálny prípad „reset farby“.
- Testovacie mapy pre `Traf sa!` a `Poskladaj!` sú presne tie, ktoré definuje
  `config.xml` (nie všetkých 8 pre každú aktivitu).

### Overenie

Počas vývoja bolo overené:

- 8/8 máp: počet objektov v `.mef` = počet `data-entity` v scéne
  (363, 749, 168, 98, 199, 202, 72, 131),
- 281 kombinácií test × obtiažnosť má neprázdny pool objektov,
- všetky testovacie a `visibleNode` labeli z configu existujú v príslušných
  `.mef` dátach,
- všetky 3 aktivity boli spustené na všetkých mapách, kde ich config definuje,
- test, vzdialenosť aj puzzle boli interaktívne overené vrátane finálneho
  výsledku, obnovenia poradia objektov a správnych farieb,
- editor bol overený pri viditeľnosti, farbách, pridávaní a presúvaní značiek,
  kreslení, ukladaní, otváraní a exporte PNG.

## Testy

```bash
npm test
```

Aktuálne **61 testov, 61 passing**. Testy pokrývajú:

- pôvodné bodovanie a prahy,
- výber otázok bez opakovania,
- puzzle toleranciu,
- atlas, štatistiky a tréning slabých miest,
- matematiku pinchu, dvojitého ťuknutia, kolieska a ukotvenia zoomu,
- prítomnosť všetkých 8 máp a presnú zhodu objektov medzi `.mef` a scénami,
- existenciu všetkých testovacích skupín z `config.xml`,
- zoznamy máp pre jednotlivé aktivity,
- prítomnosť dát, náhľadov, modulov a pôvodnej pomoci,
- relatívne cesty, manifest, help stránky a GitHub Pages workflow.

Lighthouse (mobilná emulácia): domovská obrazovka, nastavenie aktivity, hra,
výsledková karta, editor, atlas, export aj pôvodná pomoc majú **100
Accessibility, 100 Best Practices, 100 SEO a 100 Agentic Browsing** — v svetlej
aj tmavej téme.

### Dark Reader a ďalšie tmavé rozšírenia

- Aplikácia má vlastnú automatickú tému, takže nepotrebuje „dark reader lock“.
- Overené s **Dark Reader 4.9.135** v dynamickom režime, na svetlom aj tmavom
  systémovom nastavení: domov, nastavenia, hry, výsledky, editor, atlas aj
  pôvodná pomoc zostávajú čitateľné.
- SVG štítky značiek používajú pri aktívnom Dark Readeri konzervatívny
  `revert-layer` s explicitnými SVG farbami; bez rozšírenia zostáva pôvodná
  svetlá/tmavá paleta bez zmeny.
- Tmavé rozšírenie môže podľa svojho nastavenia stmaviť aj mapový podklad;
  aplikácia sa tomu nebráni, ale štítky, ovládanie a text zostávajú čitateľné.

### Automatická tmavá téma

- Aplikácia deklaruje `color-scheme: light dark` a nadväzuje na systémové
  nastavenie `prefers-color-scheme`; samostatný `dark.css` sa načíta až po
  `styles.css` a `classic.css`, takže prepisuje pôvodné svetlé komponenty.
- V hlavičke sú dve `theme-color` metas (svetlá a tmavá), takže aj lišta
  prehliadača na telefóne mení farbu spolu s témou.
- Tmavý je celý aplikačný rám — domov, nastavenia, hra, výsledky, editor,
  strom, toolbary, export, atlas, dialógy, formuláre, scrollbary aj pomoc.
  Mapové plátno zostáva zámerne na svetlom papieri (`#ece7db`), aby pôvodné
  farby máp zostali čitateľné.
- Pôvodné inline `<font color>` hodnoty z `config.xml` dostávajú v tmavom
  režime explicitné sémantické farby, inak by boli nečitateľné.
- Všetkých šesť pôvodných help stránok je prepísaných do HTML5, má responzívny
  viewport, `<main>`, meta description a rovnakú automatickú tmavú tému.
- Tmavý režim bol overený aj s Chromom spusteným s
  `--force-dark-mode --enable-features=WebContentsForceDark` na šírkach
  320, 390 a 1280 px: domov, nastavenie, hra, výsledok, editor, atlas aj pomoc.
  Kurátorovaná téma zostáva konzistentná aj vtedy, keď Chrome zapne vlastný
  auto-dark.
- Svetlý režim zostal bez zmeny pôvodných farieb.

### Stress test a QA

V rámci záverečného stress testu bolo overené:

- všetky 3 aktivity na všetkých mapách, ktoré im predpisuje `config.xml`,
  vrátane korektných odpovedí, nesprávnych odpovedí, prechodu na ďalšiu otázku
  a finálnej výsledkovej karty,
- všetkých 8 máp v editore, prepínanie máp, strom, viditeľnosť, farby, vlastné
  značky, kreslenie, save/open round-trip, export PNG/JPEG a tlač,
- šírky 320, 390, 768, 1024 a 1280 px; bez horizontálneho pretečenia,
- atlas: výber, hľadanie, filtre, tréning a návrat späť,
- 35/35 sieťových požiadaviek s HTTP 200 a čistá konzola bez chýb.

Počas testu boli opravené konkrétne problémy:

- chyba `focus` pri návrate z rýchlej hry na domovskú obrazovku,
- puzzle objekty sa teraz dostanú do popredia presne ako v origináli a po
  odpovedi sa vrátia na pôvodnú pozíciu v poradí kreslenia,
- počiatočný zoom label už neukazuje falošných 100 %,
- správna slovenská pluralizácia v nastaveniach a finálnych správach
  („3 možnosti“, „1 z 1 otázky“, „1 bod“, „1 štát“),
- výber mapy na 320 px sa nezrúti a na telefóne je horizontálny carousel
  s náhľadom ďalšej mapy,
- atlasové body už nezhadzujú audit touch-targetov; prístupný výber zostáva
  v plne klávesnicovom zozname,
- exportný dialóg sa už nemôže zaseknúť pri rýchlom potvrdení,
- rýchla mestská hra už pri tréningu zoznamu nezačína s ukrytým počtom
  otázok 1,
- dočasné editačné inputy majú stabilné `id`/`name` a čistú konzolu.

Následný mobilný a gestový audit pridal:

- plynulý dvojprstový pinch s posunom stredu a ukotvením zoomu,
- ochranu proti náhodnej odpovedi po pinchi, posune, dvojitom ťuknutí aj
  ťuknutí na ovládanie mapy,
- dvojité ťuknutie/dvojklik na priblíženie a návrat celej mapy,
- väčšie dotykové plochy značiek (44 px), zoom tlačidiel (46 px) a tlačidiel
  akcií (44 px),
- mobilné plávajúce **Ďalej** a reset výrezu na celú mapu pri novej otázke,
- automatické oddialenie Traf-sa výsledku, ak je tip alebo cieľ mimo obrazovky,
- tap-safe puzzle drag (samotné ťuknutie objekt neodošle),
- opravu svetlých štítkov značiek, ktoré predtým v svetlom režime splývali
  s pozadím,
- kompatibilitu s Dark Readerom cez `revert-layer` pre SVG štítky,
- kompaktný editor toolbar na 320 px a v krátkom landscape režime,
- relatívne cesty, `.nojekyll`, `404.html` a GitHub Pages workflow.

Overené bolo 22 kombinácií aktivita × mapa, 8 máp editora, reálne dotykové
gestá cez CDP (`touchStart`/`touchMove`/`touchEnd`), šírky 320, 390, 568
(landscape), 768, 1024 a 1280 px, Dark Reader 4.9.135, forced-dark Chromium,
GitHub Pages podcesta a finálne Lighthouse audity.

## Štruktúra

```text
webapp/
├─ index.html
├─ 404.html                   – GitHub Pages fallback
├─ styles.css                 – pôvodný moderný vizuál atlasu a rýchlej hry
├─ classic.css                – štýly klonu, editora a aktivít
├─ dark.css                   – automatická tmavá téma podľa systému
├─ js/
│  ├─ app.js                  – pôvodná mestská hra + atlas + štatistiky
│  ├─ cities.js               – 74 miest s pôvodnými súradnicami
│  ├─ scoring.js              – pôvodné mestské bodovanie
│  ├─ modes.js                – kvíz, puzzle, filtre, štatistiky
│  ├─ map-gestures.js         – testovateľná matematika pinchu a zoomu
│  ├─ classic.js              – vstupný bod klonu + deep linky
│  ├─ classic-data.js         – config.xml, .mef, XML helpery, skupiny
│  ├─ classic-ui.js           – overlaye, toasty, potvrdenia
│  ├─ map-view.js             – spoločný renderer máp, značiek a gest
│  ├─ classic-activities.js   – Vyskúšaj sa!, Traf sa!, Poskladaj!
│  └─ editor.js               – strom, farby, značky, kreslenie, súbory, export
├─ data/
│  ├─ config.xml              – pôvodná konfigurácia hier a editora
│  ├─ maps.json               – index máp a rozmerov
│  └─ maps/*.mef              – 8 pôvodných dátových súborov
├─ assets/
│  ├─ maps/*.svg              – vektorové scény všetkých 8 máp
│  ├─ thumbs/*.png            – náhľady máp
│  ├─ slovakia-map.svg        – mapa pre atlas a rýchlu hru
│  ├─ slovakia-map-vuc.svg    – s hranicami VÚC
│  ├─ editormap-logo.png
│  └─ icon.svg
├─ help/                      – pôvodná dokumentácia editora
├─ tests/
│  ├─ scoring.test.mjs
│  ├─ modes.test.mjs
│  ├─ clone.test.mjs
│  ├─ practice-stats.test.mjs
│  ├─ map-gestures.test.mjs
│  └─ deployment.test.mjs
├─ .nojekyll                  – vypne Jekyll na GitHub Pages
├─ server.mjs                 – voliteľný lokálny/LAN server
├─ manifest.webmanifest
└─ README.md
```

Deploy workflow je v `.github/workflows/pages.yml`.

## Deep linky (bonus)

- `/?mode=test` — otvorí nastavenie Vyskúšaj sa!
- `/?mode=distance&map=svet` — nastavenie Traf sa! pre svet
- `/?mode=puzzle&map=europa` — nastavenie Poskladaj! pre Európu
- `/?mode=test&map=slovensko&testIndex=0&levelIndex=2&numQ=5&autostart=1`
  — rovno spustí hru
- `/?editor=1&map=europa` — otvorí editor s Európou

## Zámerné rozdiely oproti desktopovému originálu

- Beží v prehliadači namiesto Adobe AIR.
- Súborové operácie závisia od podpory prehliadača. Chromium na `localhost`
  vie skutočne prepísať `.mef`; inde sa súbor stiahne/načíta cez picker.
- Tlač je riešená cez prehliadač (tlačiareň alebo PDF).
- Značky majú moderný vzhľad a väčšie dotykové plochy; ich dáta a správanie
  zostávajú pôvodné.
- Otázky dopĺňajú medzeru medzi typom a názvom objektu, aby boli čitateľné
  (pôvodný config ich spája bez medzery). Výsledkové čísla dostali medzery.
- Editor sa po návrate na domovskú obrazovku nevymaže; dokument zostáva
  otvorený v pamäti a pred zatvorením karty chráni pred neuloženými zmenami.

## Autori pôvodnej aplikácie a licencia

Pôvodná aplikácia **Editor máp 2** (2010):

- Autor: **RNDr. Štefan Karolčík, PhD**, © 2010
- Dizajn a programovanie: **Ing. Juraj Hrabovec – MAX MEDIA**, © 2010
- Mapové podklady: **RNDr. Daniel Gurňák, PhD**, © 2010

Pôvodná licencia povoľuje používanie aplikácie a jej výstupov výlučne na
vzdelávacie účely v rámci uvedených školských projektov a nekomerčných
edukačných aktivít; výstupy majú mať pripojené logo aplikácie. Táto webová
verzia je nekomerčná edukatívna reimplementácia. Logo pôvodnej aplikácie je
zobrazené v hlavičke a pätičke a všetky mapové podklady zostávajú dielom
pôvodných autorov. Priečinok `software/` obsahuje pôvodné distribučné súbory
a nie je súčasťou webovej aplikácie.

Ak chceš pôvodnú aplikáciu alebo jej výstupy používať mimo týchto podmienok,
kontaktuj autorov.
