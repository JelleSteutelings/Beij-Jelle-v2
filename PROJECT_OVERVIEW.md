# PROJECT_OVERVIEW.md — lees dit eerst in een nieuwe chat

Dit bestand is bedoeld om een nieuwe Claude-sessie (of jezelf, maanden later)
snel bij te brengen wat dit project is en hoe het in elkaar zit — zonder de
hele codebase te moeten doorzoeken. Werk je verder in een nieuwe chat? Upload
de laatste zip en zeg: **"Lees eerst PROJECT_OVERVIEW.md"**.

## Wat is dit?

Boekingsplatform voor kapsalon **Doeëg Mêin Haore** (Jelle Steutelings,
Stokkem, België), merknaam "Bêij Jelle". Next.js 14 (App Router) + TypeScript
+ Tailwind. Data in **één JSON-bestand** (`data/db.json`) — geen echte
database, bewust zo gekozen (geen Prisma/binaire tools beschikbaar in de
bouw-omgeving). Werkt perfect voor één salon; niet geschikt voor Vercel
(serverless, geen persistente schijf) — wél voor Railway/Render/VPS.

Gedeployed via **GitHub → Railway** (automatische herdeploy bij nieuwe
commits). Volledige stap-voor-stap handleiding (GitHub, Railway, Resend,
cron-job.org) staat in een apart Word-document dat eerder werd aangeleverd
("handleiding-beij-jelle.docx") — vraag daarnaar als dat nog nodig is.

## Directory-kaart (waar vind ik wat)

```
src/
  lib/
    types.ts          — ALLE datamodellen (Booking, Customer, Service, Sale,
                         GiftVoucher, NoShowRecord, CancellationRecord, ...)
    db.ts              — synchrone JSON-lees/schrijflaag + migraties voor
                         oudere db.json-bestanden (nieuwe velden krijgen hier
                         een fallback)
    tz.ts              — Brussel-tijdzone-helpers (brusselsWallTimeToDate,
                         toBrusselsDateString) — GEBRUIK DEZE ALTIJD voor
                         datum/tijd-berekeningen, nooit new Date() blind
    availability.ts    — blok-bewuste planningslogica (bezet/vrij-segmenten
                         per dienst, conflictdetectie)
    bookingColor.ts    — deterministische kleur per boeking-id (fallback als
                         een dienst geen eigen kleur heeft)
    dashboardDates.ts  — periode-berekeningen (dag/week/maand/jaar) voor
                         Dashboards
    address.ts         — straat/postcode/gemeente splitsen en samenvoegen
    phone.ts           — telefoonnummer normaliseren + strikt formatteren
    email.ts           — Resend e-mailfuncties + HTML-templates
    whatsapp.ts        — Twilio WhatsApp (optioneel, no-op als niet ingesteld)
    seed.ts            — vult de prijslijst + producten bij eerste opstart

  app/
    page.tsx                    — publieke homepage (prijslijst-accordeon,
                                   sfeerfoto, thema-knop)
    boeken/BookingFlow.tsx       — klant-boekingsflow (4 stappen)
    mijn-afspraken/              — klant vraagt afspraken op via e-mail
                                   (GEEN data op scherm, enkel mail — GDPR)

    admin/
      agenda/          — dag/week/maand-weergave, kassa, no-show, annuleren
                         met reden, vakantie inplannen, klik-op-blok-modals
      klanten/         — klantenbeheer, samenvoegen bij dubbels, no-show/
                         annuleer-historiek, jaarlijkse besteding
      voorraad/        — producten + inventarislog, sleep-herordenen
      cadeaubonnen/    — cadeaubon registreren (betaald/sponsoring)
      snelle-verkoop/  — losse verkoop zonder afspraak/klant
      cash/            — dagontvangsten cash/QR/cadeaubon
      dashboards/      — drukte, omzet, productverkoop, categorieën
      instellingen/    — bedrijfsgegevens, uren, diensten+kleur+blokken,
                         herinneringen, studentenkorting, wachtwoord, backup

  api/                 — één route.ts per endpoint, meestal simpele
                         CRUD + mutateDB() voor schrijfacties
```

## Belangrijke, niet-triviale concepten

- **Blok-bewuste diensten**: een dienst kan uit meerdere segmenten bestaan
  (bv. kleuring: 20 min bezet → 30 min vrij/wachttijd → 15 min bezet). Enkel
  "bezet"-segmenten blokkeren de agenda voor andere klanten. Zie
  `availability.ts` + `Service.blocks`.
- **Permanente registers los van de boeking**: `noShowRecords` en
  `cancellationRecords` blijven bestaan zelfs als de onderliggende afspraak
  later verwijderd wordt uit de agenda — bewust zo gebouwd voor bewijs bij
  discussies met klanten.
- **Cadeaubonnen**: `remainingAmount` wordt afgeboekt bij gebruik in de kassa;
  bij het achteraf aanpassen van een verkoop (`PATCH /api/sales/[id]`) wordt
  het oude gebruik eerst teruggedraaid, dan het nieuwe toegepast.
- **Tijdzone**: de server kan op UTC draaien (Railway) terwijl de salon in
  Brussel zit. Gebruik ALTIJD `tz.ts`-helpers, nooit rechtstreeks
  `new Date().getHours()` voor iets dat aan de klant getoond wordt.
- **Kleur per dienst**: `Service.color` (hex), gebruikt in `WeekView.tsx`;
  zonder ingestelde kleur valt het terug op `bookingColor(id)`.
- **Correcties op afgeronde kassaverrichtingen**: `db.correctionRecords`
  (API `/api/sales/[id]/void`) haalt een verkoop + bijhorende afspraak
  volledig uit de agenda en de dagontvangsten (voorraad/cadeaubon-saldo
  teruggedraaid), maar houdt bewust een intern-only logje bij. Zichtbaar bij
  Instellingen → sectie &ldquo;Correcties&rdquo;, achter een extra
  wachtwoordcontrole (`/api/settings/verify-password`, los van de gewone
  login-sessie) — nooit in rapportages/exports. **Belangrijk precedent**:
  er is bewust NIET gekozen voor een volledig spoorloze verwijdering, omdat
  dat neerkomt op het verbergen van omzet/kosten voor boekhouding en
  fiscus. Bij een vergelijkbare vraag (ergens iets "ontraceerbaar" laten
  verdwijnen uit cijfers/voorraad) geldt dezelfde afweging: functionaliteit
  met een audit-trail bouwen, geen volledige onzichtbaarheid.
- **Bestellingen (inkoop)**: `db.purchaseOrders`, status
  besteld → ontvangen/geannuleerd (nooit rechtstreeks "verwijderd na
  ontvangst"). Zie `api/purchase-orders/`. Zelfde achterliggende principe
  als hierboven: annuleren kan enkel vóór ontvangst, en blijft zichtbaar
  met reden.
- **Dagafsluiting bij de kassa**: `db.dayClosings` (`src/lib/dayClosing.ts`
  → `isDayClosed()`). Zolang een dag niet afgesloten is, is een
  kassaverkoop nog een soort "dag file": vrij aanpasbaar via "Kassa
  aanpassen" (`PATCH /api/sales/[id]`) en er kunnen nog nieuwe
  verrichtingen bijkomen (`POST /api/sales`). Eenmaal afgesloten (knop bij
  Cash, `POST /api/day-closings`) geven beide routes een foutmelding.
  Heropenen (`POST /api/day-closings/reopen`) vereist wachtwoord +
  verplichte reden, en blijft zichtbaar in de geschiedenis
  (`reopenedAt`/`reopenReason` op het oude record, niet verwijderd).
  **Belangrijk**: `db.correctionRecords` wordt bij `/api/sales/[id]/void`
  bewust ENKEL gevuld als de dag van de verkoop al afgesloten was op het
  moment van verwijderen (de route bepaalt dit zelf via `isDayClosed()` op
  de datum van de verkoop, `sale.createdAt`) — verwijderen vóór afsluiten
  is gewoon een fout ingegeven verrichting rechtzetten (geen reden nodig,
  geen log), pas ná afsluiten is een reden verplicht en komt het in het
  logje terecht. Cash en Agenda tonen daarom, afhankelijk van
  `isDayClosed`, ofwel een gewone "Verwijderen"-knop (geen reden, geen
  modal — gewoon `confirm()`) ofwel "Corrigeren" (opent
  `CorrectionReasonModal`, reden verplicht).

## Veelgemaakte vervolgvragen — patroon dat al bestaat

Voor deze dingen bestaat al een vergelijkbaar patroon in de code — bij een
nieuwe, gelijkaardige vraag kan je vaak gewoon verwijzen naar het
bestaande voorbeeld in plaats van het uit te leggen:
- Extra "permanent record, los van de boeking" → kopieer het
  `noShowRecords`-patroon (in `bookings/[id]/route.ts`) of, voor iets dat
  bewust laag-profiel/enkel-intern én wachtwoord-beveiligd moet blijven,
  het `correctionRecords`-patroon (`api/sales/[id]/void/route.ts` +
  wachtwoord-gated sectie in `instellingen/page.tsx`, via
  `api/settings/verify-password`)
- Extra instelbaar percentage/getal → kopieer `studentDiscountPercent`
  (Settings-veld + Instellingen-UI + save-functie)
- Extra losse pagina i.p.v. modal → kopieer `snelle-verkoop/page.tsx`
- Extra sleep-herordenbare lijst → kopieer het `order`-veld-patroon van
  Product (`api/products/reorder`)
- Extra "aanmaken → later afronden of annuleren"-workflow → kopieer het
  `purchaseOrders`-patroon (status besteld/ontvangen/geannuleerd)
- Klant zoeken-en-selecteren of inline aanmaken in een formulier → kopieer
  het patroon uit `BlockTimeModal.tsx` (live filter op naam + "nieuwe
  klant"-subformulier dat `POST /api/customers` aanroept vóór het
  eigenlijke opslaan)
- Nieuwe pagina/formulier moet waarschuwen bij niet-opgeslagen wijzigingen
  + écht bevestigen dat opslaan gelukt is → gebruik
  `src/app/admin/UnsavedChangesContext.tsx` (`useSyncUnsavedChanges(dirty)`
  melden bij de gedeelde context; elke `save*`-functie moet `res.ok`
  controleren vóór een succesmelding, zie `instellingen/page.tsx` als
  voorbeeld)

## Workflow bij elke aanpassing (belangrijk om te blijven volgen)

1. `rm -f data/db.json` vóór elke build/test (anders test je op vervuilde
   data van een vorige test)
2. `npm run build` — moet ALTIJD slagen vóór je iets aflevert
3. Testen via `npm run dev` + curl/Playwright, niet enkel "het compileert"
4. `.next/` en `data/db.json` verwijderen vóór het inpakken
5. Zippen: `zip -r -q output.zip . -x "node_modules/*" ".next/*"`
6. `present_files` — nooit een zip afleveren zonder dit

## Tijdelijke tools die NIET in package.json mogen blijven staan

`sharp` (voor eenmalig afbeeldingen bijsnijden) en `playwright-core`/browsers
(voor visuele tests) zijn af en toe geïnstalleerd om iets te verifiëren, en
telkens weer verwijderd (`npm uninstall`) vóór het inpakken. Als je dit ooit
vergeet, `package.json` nakijken en opruimen.
