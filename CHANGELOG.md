# Changelog — Bêij Jelle boekingsplatform

Overzicht van alle aanpassingen, in omgekeerd-chronologische volgorde (nieuwste
eerst). Nuttig om snel te zien wat er al gebouwd is, zonder de hele
gespreksgeschiedenis te moeten doorzoeken.

## 2026-08-21 (later op de dag)

- **Cash-lijst kan nu ook aanpassen/verwijderen**: bij elke verrichting in
  de dagontvangsten staat nu een knop om ze aan te passen (dezelfde "Kassa
  aanpassen"-modal als in de Agenda) of te verwijderen/corrigeren — werkt
  ook voor losse verkopen (Snelle verkoop) zonder gekoppelde afspraak, die
  voorheen nergens achteraf aan te passen waren.
- **Verwijderen vóór afsluiten logt niet meer**: zolang een dag nog niet
  definitief is afgesloten, is een verkeerd ingegeven kassaverrichting
  verwijderen nu een simpele bevestiging — geen reden meer nodig, en er
  komt geen entry meer in het interne correctielogje (`db.correctionRecords`).
  Dat logje is bewust enkel nog voor wat er ná de definitieve afsluiting
  gecorrigeerd wordt (`POST /api/sales/[id]/void` bepaalt dit zelf aan de
  hand van `isDayClosed()` op de datum van de verkoop) — dat was ook de
  eigenlijke reden om dagafsluiting te vragen, niet om alles te loggen.
  Zowel Cash als Agenda tonen daarom nu, afhankelijk van of de dag al
  afgesloten is, een gewone "Verwijderen"-knop (geen reden) of de
  bestaande "Corrigeren"-knop (reden verplicht, gelogd).

## 2026-08-21

- **Dagafsluiting bij de kassa**: kassaverrichtingen komen niet langer
  "los" te staan — zolang een dag nog niet definitief afgesloten is, blijft
  ze een soort "dag file": nog vrij aan te passen via de bestaande "Kassa
  aanpassen"-flow. Bij Cash staat nu een knop "Dag definitief afsluiten"
  (met bevestiging + overzicht van wat er verandert). Eenmaal afgesloten:
  - kan er niet meer via "Kassa aanpassen" gewijzigd worden aan verkopen
    van die dag, en kunnen er geen nieuwe verrichtingen meer bijkomen voor
    die datum (`PATCH`/`POST /api/sales` geven een duidelijke foutmelding);
  - blijft de bestaande wachtwoord-beveiligde correctieflow (agenda →
    kassaverrichting corrigeren, met reden) wél nog mogelijk — zelfde
    precedent als elders: geen spoorloze wijzigingen, wel een audit-trail;
  - kan de dag, per ongeluk te vroeg afgesloten, terug geopend worden bij
    Cash achter dezelfde extra wachtwoordcontrole als bij Correcties, met
    verplichte reden (nooit stilzwijgend).
  Nieuw datamodel `DayClosing` (`db.dayClosings`), nieuwe endpoints
  `GET/POST /api/day-closings` en `POST /api/day-closings/reopen`.

## 2026-08-20 (nacht)

- **Diensten toevoegen en verwijderen** bij Instellingen → Diensten &amp;
  prijzen: een &ldquo;+ Nieuwe dienst&rdquo;-knop opent een inline formulier
  (naam, categorie — kiezen uit bestaande of een nieuwe typen, prijs, duur);
  een kleine &ldquo;×&rdquo; naast elke &ldquo;Blokken&rdquo;-knop verwijdert
  een dienst (met bevestiging). Beide gebeuren onmiddellijk (niet via de
  &ldquo;Opslaan&rdquo;-knop van de rest van de sectie). Nieuwe API's:
  `POST /api/services`, `DELETE /api/services/[id]`.
- **Zoekbalk bij Voorraad → Producten**: filtert de productenlijst live op
  naam. Het handmatig herordenen (slepen/pijltjes) blijft correct werken
  ook met een actief filter, doordat de echte positie in de volledige lijst
  (niet de gefilterde) gebruikt wordt.

## 2026-08-20 (avond)

- **Correcties nog discreter gemaakt**: in plaats van een volledige sectie
  bovenaan bij Instellingen, nu helemaal onderaan de pagina een klein,
  onopvallend zinnetje &ldquo;Correcties bekijken&rdquo;. Het
  wachtwoordveld verschijnt pas na het klikken op dat zinnetje (voorheen
  stond het altijd zichtbaar).

## 2026-08-20 (later op de dag)

- **Correcties verplaatst van Cash naar Instellingen**, en **beveiligd met
  het beheerderswachtwoord** (los van de gewone login-sessie — je moet het
  wachtwoord opnieuw intypen om de lijst te zien). Nieuw endpoint
  `POST /api/settings/verify-password` (controleert enkel, maakt geen
  nieuwe sessie aan). Toont nu de volledige geschiedenis in één lijst i.p.v.
  per dag, met een &ldquo;Vergrendelen&rdquo;-knop om terug dicht te
  klappen.

## 2026-08-20

- **Klant zoeken/toevoegen bij het klikken op een vrije plaats in de
  agenda** (`BlockTimeModal.tsx`): een zoekveld filtert live op naam uit de
  bestaande klantenlijst; &ldquo;+ Nieuwe klant toevoegen&rdquo; opent een
  klein inline formulier (naam + GSM) dat de klant meteen aanmaakt en
  koppelt aan de afspraak (`customerId`). Blijft ook gewoon werken met enkel
  een losse naam, zoals voorheen. Loste meteen een bestaande tekortkoming
  op: handmatig aangemaakte afspraken kregen voorheen nooit een
  `customerId`, ook niet als de naam toevallig overeenkwam met een bestaand
  klantprofiel.
- **Kassaverrichting corrigeren**: een afgeronde afspraak kan volledig uit
  de agenda én de dagontvangsten gehaald worden (voorraad en
  cadeaubon-saldo worden teruggedraaid), met een verplichte reden. Blijft
  bewaard in een intern logje (`db.correctionRecords`, API
  `/api/sales/[id]/void`) dat **enkel bij Cash, ingeklapt, enkel voor de
  beheerder** zichtbaar is — geen deel van rapportages/exports. Bewust
  gekozen boven een volledig spoorloze verwijdering (zie
  `PROJECT_OVERVIEW.md` voor de afweging).
- **Bestellingen klaarzetten** (nieuw tabblad bij Voorraad): een bestelling
  aanmaken (leverancier, producten — bestaand of nieuw — aantallen,
  aankoopprijs) blijft op &ldquo;besteld&rdquo; staan tot ze:
  - **afgerond** wordt (&ldquo;Ontvangen &amp; afronden&rdquo;) → komt dan pas
    in de stock en de kosten terecht; een nog onbekend product wordt
    automatisch aangemaakt;
  - of **geannuleerd** wordt (enkel voor bestellingen die uiteindelijk niet
    geleverd zijn) → blijft zichtbaar in de geschiedenis mét reden.
  Een ontvangen bestelling kan nadien niet meer verwijderd of geannuleerd
  worden. Nieuwe API's onder `/api/purchase-orders`.

## 2026-08-14 (avond)

- **Bloknummer zichtbaar in de agenda** bij afspraken met meerdere blokken:
  &ldquo;B1&rdquo;/&ldquo;B2&rdquo;/&ldquo;B3&rdquo;... na de klantnaam in de week­weergave
  (blijft altijd zichtbaar — de klantnaam wordt eerder afgekapt dan het
  bloknummer) en &ldquo;Blok 1/2/3&rdquo; voor elk tijdsegment in de dagweergave.

- **Blok-kleuren gelden nu ook voor al geplande afspraken.** De agenda
  (weekweergave) zocht de kleur van blok 2+ eerst op in een snapshot die
  vastlag op het moment van boeken; een latere kleurwijziging bij de dienst
  was dan niet zichtbaar bij afspraken die al in de agenda stonden. Kleur
  wordt nu altijd live opgezocht bij de huidige dienst-instellingen
  (`WeekView.tsx`), dus een kleurwijziging is meteen zichtbaar bij alle
  afspraken — ook al eerder geplande. (`BookingBlock.color` daardoor niet
  meer nodig, terug verwijderd.)
- **"Volledig scherm"-knop bij de Agenda**, vooral handig op een laptop: zet
  de zijbalk opzij en laat de week-/dagweergave de volle breedte gebruiken,
  en probeert daarnaast de browser in echt volledig scherm te zetten (native
  Fullscreen-API, met nette fallback als dat niet toegelaten is). De
  voorkeur wordt onthouden tussen bezoeken. Techniek: nieuwe
  `LayoutModeContext` waarmee een pagina de zijbalk tijdelijk kan verbergen.

## 2026-08-14

- **Eigen kleur per blok** bij Instellingen → Diensten &amp; prijzen → Blokken:
  - Blok 1 volgt altijd de hoofdkleur van de dienst (niet apart instelbaar)
  - Blok 2 t.e.m. 5 krijgen een eigen kleurkiezer zodra er minuten zijn
    ingegeven én het blok op &ldquo;Bezet&rdquo; staat (een &ldquo;×&rdquo;-knopje
    zet het terug naar de hoofdkleur); een &ldquo;Vrij&rdquo;-blok (wachttijd)
    krijgt geen kleuroptie
  - In de agenda (weekweergave) krijgt zo'n blok zijn eigen kleur als vulling,
    met links een smalle baan in de hoofdkleur zodat het visueel gelinkt
    blijft aan de dienst
  - `ServiceBlock` kreeg een optioneel `color`-veld

## 2026-08-13 (later op de dag)

- **Niet-opgeslagen wijzigingen worden nu gemeld** in plaats van stilzwijgend
  verloren te gaan. Aanleiding: bij Instellingen → Diensten &amp; prijzen kon je
  een kleur instellen, wegnavigeren zonder op te slaan, en de wijziging was
  spoorloos weg. Opgelost via een gedeelde context
  (`src/app/admin/UnsavedChangesContext.tsx`):
  - browser-niveau (tab sluiten/verversen) → native waarschuwing
  - binnen de app (klik op een ander menu-item, uitloggen, klant wisselen) →
    bevestigingsvenster vóór het weggaan
  - een blijvende gele melding &ldquo;⚠ Niet-opgeslagen wijzigingen&rdquo;
    onder elke sectie zolang er iets niet bewaard is
  - toegepast op Instellingen (alle secties: bedrijfsgegevens, richturen,
    diensten &amp; prijzen, herinneringen, studentenkorting, wachtwoord,
    QR-afbeelding), Klanten (contactgegevens, herinnering-override, nieuwe
    klant) en Voorraad (nieuw product)
- **Opslaan meldt nu ook écht of het gelukt is.** Voorheen toonden alle
  hierboven genoemde &ldquo;Opslaan&rdquo;-knoppen altijd &ldquo;opgeslagen&rdquo;,
  zelfs als de server-aanvraag mislukte (geen `res.ok`-controle). Nu: groene
  bevestiging enkel bij succes, rode foutmelding bij mislukking, en de
  ingevoerde gegevens blijven staan zodat je opnieuw kan proberen zonder
  alles te moeten hertypen.

## 2026-08-13

- **Voorraad**: producten herordenen via slepen (sleep-handvat ⠿), naast de
  bestaande ↑/↓-pijltjes
- **Kleur per dienst**: instelbaar bij Instellingen → Diensten, gebruikt in
  de agenda in plaats van de automatische kleur
- **Weekweergave agenda**: elk afzonderlijk blok (ook bij meerdere
  segmenten per afspraak) toont nu de starttijd van dát blok + klantnaam
- **Klik op een blok in de weekweergave** → pop-upvenster met alle info en
  acties (bevestigen/kassa/no-show/annuleren/verwijderen); klik op een vrij
  vak → rechtstreeks een afspraak toevoegen met voor-ingevulde starttijd
- **Snelle verkoop** verplaatst van een knop in de agenda naar een eigen
  pagina in de linkse menulijst (onder Cadeaubonnen)
- **Studentenkorting**: percentage nu instelbaar bij Instellingen (was vast
  op 10%)
- **Annuleren met reden**: apart van no-show, met een eigen blijvend
  register (het tijdstip komt terug vrij, andere impact dan een no-show)
- **Snelle verkoop**: losse productverkoop zonder afspraak of klantprofiel
  (bv. een klant die binnenspringt voor een shampoo)
- **Mijn afspraken**: omgezet van telefoonnummer-opzoeking naar
  e-mailadres — de klant krijgt de afspraken nu per mail, er verschijnt
  nooit meer afsprakendata rechtstreeks op het scherm (GDPR-vriendelijker)
- `PROJECT_OVERVIEW.md` en dit `CHANGELOG.md` toegevoegd, voor snellere
  opstart in een nieuwe chat

## 2026-08-07 — 2026-08-08

- **Dag/nacht-thema**: knop op de homepage, donker blijft standaard, keuze
  wordt onthouden
- **Subtiel logo op de achtergrond** over alle pagina's (nadien bijgesneden
  om een onbedoelde lichte balk uit het origineel te verwijderen)
- **Test e-mail versturen**: knop bij Instellingen om de Resend-koppeling
  te controleren zonder een echte boeking te moeten maken
- Handleiding uitgebreid met een hoofdstuk "Wachtwoorden en sleutels"

## 2026-07-31

- **Kassa**: totaalbedrag rechtstreeks aanpasbaar (bv. voor een korting),
  los van de som van de items
- **Achteraf aanpassen**: bij een al afgeronde afspraak kan het bedrag of
  de betaalwijze nog gewijzigd worden (i.p.v. een extra bevestigingsstap
  vóór het afronden, wat eerst gebouwd en op vraag terug vereenvoudigd werd)
- **Dashboards**: nieuw tabblad — drukte per uur, omzet (cash/QR/cadeaubon),
  productverkoop, categorieën (kleuring/snit/brushing vrouwen, snit heren,
  studenten, cadeaubonnen), plus no-show-percentage, gemiddelde besteding,
  nieuwe klanten, top klanten
- **Cash**: nieuw tabblad met dagontvangsten, gesplitst per betaalwijze
- Bugfix: kassaverkopen zonder klantprofiel (bv. handmatige afspraken)
  toonden geen naam — nu wordt de naam rechtstreeks op de verkoop bewaard

## 2026-07-30

- **Cadeaubonnen**: volledige module — registreren (betaald of gratis als
  sponsoring), gebruiken (geheel of deels) bij de kassa, saldo-opvolging
- **No show**-knop, apart van annuleren, met een **blijvend register** dat
  bewaard blijft ook als de afspraak later uit de agenda verwijderd wordt
  (inclusief correctiemogelijkheid bij een vergissing)
- **Klanten samenvoegen**: bij een dubbele klant (bv. door een tikfout in
  naam/telefoonnummer) alles overzetten naar de juiste klant
- **Telefoonnummer**: strikt, verplicht formaat (+32 4XX XX XX XX) overal
  waar het ingevuld wordt
- **Besteed per jaar**: overzicht bij elke klant, berekend uit de
  kassageschiedenis
- **Excel-export** (leesbare back-up): Klanten, Afspraken, Diensten,
  Voorraad (met aankoopwaarde-totaal), Voorraadbewegingen, Verkopen,
  Cadeaubonnen, No-shows, Instellingen — als alternatief naast de
  technische JSON-back-up
- **Inventaris**: huidige voorraad + aankoopwaarde per product zichtbaar,
  bewegingen kunnen achteraf verwijderd/gecorrigeerd worden
- **Product bewerken**: naam/prijzen/minimum aanpasbaar zonder een nieuwe
  voorraadbeweging te moeten loggen
- Handleiding (Word-document) opgesteld: GitHub, Railway, Resend,
  cron-job.org, back-ups, wachtwoorden

## 2026-07-29 — 2026-07-28

- **Mijn afspraken**: klant kan (destijds nog via telefoonnummer, later
  omgezet naar e-mail) zijn eerstvolgende afspraken opvragen
- **Klantgegevens volledig bewerkbaar** door de beheerder (naam, telefoon,
  e-mail, adres) — voorheen enkel het adres
- **Adres** opgesplitst in straat/nr en postcode/gemeente (i.p.v. één vrij
  veld)
- Bugfix: handmatig toegevoegde afspraken (via "Afspraak toevoegen") hielden
  geen rekening met bezet/vrij-blokken van een dienst
- Diverse "Terug naar home"-knoppen toegevoegd/vergroot doorheen de
  boekingsflow
- Merknaam-typfout gecorrigeerd (Bëij → **Bêij** Jelle, overal consistent)
- Uitleg/bugfixes: login-sessieduur, na uitloggen naar boekingsscherm i.p.v.
  inlogscherm, "geen tijdsloten" op een dag die gewoon gesloten is (geen bug)

## Eerste versie (vóór dit changelog)

Volledig boekingsplatform: publieke site met prijslijst, boekingsflow (4
stappen, flexibele uren met aanvraag buiten de normale uren), agenda
(dag/week/maand, tijd blokkeren, vakantie), kassa (cash/QR, producten
toevoegen), klantenbeheer, voorraadbeheer, instellingen (bedrijfsgegevens,
uren, diensten/prijzen/blokken, herinneringen, wachtwoord, back-up),
e-mailherinneringen (lang/kort, aanpasbaar), WhatsApp (optioneel),
PWA-installeerbaar, deployment via GitHub + Railway.
