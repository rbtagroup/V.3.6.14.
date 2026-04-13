RB TAXI – Výčetka 3.6.9 mobile compact return

Změny oproti 3.6.7:
- na mobilu je skrytý horní přehled (Účtované km / KM smluvní / Netto po přístavném / Rozdíl vs minimum / stavová hláška)
- na mobilu zůstává kompaktní verze výčetky z 3.6.7
- spodní dashboard je na mobilu skrytý
- zachováno: celé Kč bez desetinných míst
- zachováno: bez textu Ponechte prázdné
- nová cache verze service workeru

Audit opravy 3.6.10:
- export knihovny html2canvas a jsPDF jsou lokálně ve vendor/ a v offline cache
- opraveno čtení nastavení: provize musí být 1–100 %, fixy mohou být i 0 Kč
- finanční pole mají min/step/inputmode pro mobilní zadávání
- přidána kontrola, že smluvní km nesmí být vyšší než najeté km
- doplněno vysvětlení Přístavného: vyjímá se z provize, ale zůstává k odevzdání
- doplněna základní PWA metadata a lepší ovládání dialogu nastavení
- přidán spustitelný výpočetní self-test: node vypocet-selftest.js

Opravy 3.6.11:
- odstraněn CSS color-mix z placeholderů kvůli kompatibilitě s html2canvas exportem
- validační a exportní chyby se ukazují v hlášce v aplikaci místo alertů
- tlačítka exportu se během přípravy výstupu dočasně vypnou
- nová cache verze service workeru pro načtení opraveného exportu

Vzhled 3.6.12:
- kompaktnější formulář: nižší pole, tlačítka, menší paddingy a radiusy
- zmenšený header, logo a hlavní karty
- zjemněné stíny a snížená výška spodního dashboardu
- mobilní ovládání ponecháno nad cca 44 px pro pohodlné klepnutí
- v hlavičce aplikace se zobrazuje aktuální verze
