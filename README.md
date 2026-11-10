# Editor máp 2 — webová verzia

Kartografická webová reimplementácia pôvodnej hry **Editor máp 2** (2010):
osem pôvodných máp, tri aktivity, atlas 74 slovenských miest a plnohodnotný
editor máp — všetko bez registrácie a bez serverovej logiky.

## Rýchly štart

```bash
cd webapp
npm start
```

Otvor <http://localhost:8124/>. Aplikácia nepotrebuje `npm install` ani build
krok; stačí Node.js 18+.

## Čo je vo vnútri

- **Vyskúšaj sa!**, **Traf sa!** a **Poskladaj!** na pôvodných mapách a s
  pôvodnými testami, obtiažnosťami a bodovaním.
- **Traf sa!** z hrdinu domovskej stránky štartuje rovno: ťažká obtiažnosť,
  10 otázok, Slovensko.
- **Editor máp** s vrstvami, farbami, vlastnými značkami, kreslením,
  ukladaním `.mef`, exportom PNG/JPEG a tlačou.
- **Atlas 74 miest** s hľadaním, filtrami, štatistikami a rýchlym tréningom.
- Vycentrovaný zoom, presné pinch ukotvenie, plynulý posun so zotrvačnosťou
  a tmavá mapová tabuľa.

## Dokumentácia

- [Používateľská a technická dokumentácia](webapp/README.md)
- [Nasadenie na GitHub Pages](DEPLOYMENT.md)

## Nasadenie

Repozitár obsahuje hotový GitHub Actions workflow, ktorý publikuje `webapp/`
ako statickú stránku. Postup na tvojej strane je v [DEPLOYMENT.md](DEPLOYMENT.md).

## Licencia a pôvod

Nekomerčná edukatívna reimplementácia. Pôvodná hra a mapové podklady patria
ich autorom; podrobnosti sú v aplikácii v časti **O aplikácii**.
