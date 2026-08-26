# Bêij Jelle — Boekingsplatform voor Doeëg Mêin Haore

Een boekingsplatform op maat van kapsalon **Doeëg Mêin Haore** (Jelle
Steutelings, Stokkem): klanten boeken online of via de "app" (installeerbaar
op het startscherm), en Jelle beheert alles zelf — agenda, klanten, voorraad,
kassa en instellingen.

## Wat zit erin?

- **Publieke website** met prijslijst, openingsuren, adres en contact
- **Boekingsflow** (dienst → moment → gegevens → bevestiging), installeerbaar
  als app op de telefoon (PWA)
- **Flexibele uren**: normale tijdsloten worden automatisch bevestigd; een
  vroeger of later moment kan de klant aanvragen, en dat komt bij Jelle
  binnen als "aanvraag" ter bevestiging
- **Agenda** (dag-overzicht, tijd blokkeren, handmatige afspraken, aanvragen
  bevestigen/afwijzen)
- **Kassa**: afspraak afronden met cash of QR-code (Payconiq/Bancontact),
  eventueel producten uit voorraad toevoegen aan de bon
- **Klantenbeheer** met historiek van afspraken en aankopen
- **Voorraadbeheer** met lage-voorraad melding
- **Instellingen**: bedrijfsgegevens, richturen per dag, prijzen/duur per
  dienst, wachtwoord wijzigen

## Belangrijk: hoe de data wordt opgeslagen

Dit project bewaart alle gegevens (afspraken, klanten, voorraad, verkopen,
instellingen) in **één simpel JSON-bestand**: `data/db.json`. Voor één salon
met één kapper is dit ruim voldoende en heel eenvoudig te back-uppen (het is
letterlijk één bestand dat je kan kopiëren of mailen).

**Waar dit wel/niet werkt:**
- ✅ Een gewone server met een "always-on" proces en een schijf die blijft
  bestaan: een VPS, Railway, Render, Fly.io, DigitalOcean App Platform, een
  Raspberry Pi thuis, enz. Hier werkt het meteen, zonder verdere aanpassing.
- ❌ **Niet geschikt voor Vercel (serverless)** in de huidige vorm: Vercel's
  functies hebben een tijdelijk, niet-persistent bestandssysteem, dus
  boekingen zouden verloren gaan. Wil je toch per se op Vercel draaien? Dan
  moet de databaselaag (`src/lib/db.ts`) vervangen worden door een echte
  gehoste database (bv. Postgres via Neon/Supabase). Laat het weten, dan
  help ik dat om te bouwen.

*(Achtergrond: Prisma en andere databasetools met binaire onderdelen konden
niet geïnstalleerd worden in de omgeving waarin dit gebouwd is — vandaar deze
eenvoudige aanpak. Voor een salon van deze grootte is dit geen beperking,
enkel een aandachtspunt bij het kiezen van een hostingprovider.)*

## Lokaal draaien

```bash
npm install
cp .env.example .env.local   # pas SESSION_SECRET aan
npm run dev
```

Open http://localhost:3000 voor de site, en http://localhost:3000/admin voor
het beheer.

**Standaard admin-wachtwoord:** `jelle2026` — verander dit meteen via
Instellingen → Wachtwoord wijzigen, of pas het aan in `src/lib/db.ts`
(`adminPasswordHash`) vóór de eerste opstart.

## Tijdzone

Alle openingsuren en tijdsloten worden intern altijd als **Europe/Brussels**
tijd behandeld, ongeacht in welke tijdzone de server zelf draait (dus ook
veilig op een Amerikaanse of UTC-server). Klanten en Jelle zien via hun eigen
browser (in België) gewoon de juiste, lokale tijd.

## Deployen (aanbevolen: Railway of Render)

1. Zet dit project in een git-repository (GitHub/GitLab).
2. Maak een nieuw project aan op [Railway](https://railway.app) of
   [Render](https://render.com), koppel de repository.
3. Zet de environment variable `SESSION_SECRET` op een lange willekeurige
   waarde.
4. **Belangrijk:** koppel een "persistent volume"/schijf gekoppeld aan de
   map `data/` zodat `db.json` niet verloren gaat bij een herstart of nieuwe
   deploy (bij Railway: "Volumes", bij Render: "Disks"). Zonder dit raak je
   bij elke nieuwe deploy je boekingen kwijt.
5. Build command: `npm run build` — Start command: `npm run start`.
6. Koppel je eigen domeinnaam via de instellingen van de hostingprovider.

## WhatsApp-berichten (bevestiging + herinneringen)

WhatsApp is ingebouwd, maar vraagt — in tegenstelling tot e-mail — een
**bedrijfsverificatie bij Meta** voor je het echt kan gebruiken. Dit kan ik
niet namens jullie doorlopen; hieronder de stappen die Jelle (of jij) zelf
moet zetten.

### Waarom dit ingewikkelder is dan e-mail

WhatsApp laat bedrijven niet zomaar berichten sturen naar klanten. Een
bericht dat de zaak zelf initieert (zoals een afspraakherinnering, buiten
een gesprek dat de klant zelf startte) moet volgens WhatsApp's regels via
een **vooraf goedgekeurde berichtsjabloon ("message template")** verlopen.
Dat goedkeuringsproces loopt via Meta en kan enkele dagen duren. Er zijn
ook kosten per gesprek (meestal een paar cent, afhankelijk van het land).

### Stap 1 — Test gratis met Twilio's WhatsApp Sandbox

Om alles zonder kosten of goedkeuring uit te proberen:

1. Maak een gratis account op [twilio.com](https://www.twilio.com)
2. Ga naar **Messaging → Try it out → Send a WhatsApp message** in het
   Twilio-dashboard — dit geeft je een sandbox-nummer en een code om te
   activeren (je stuurt zelf een WhatsApp-bericht naar dat nummer om je
   eigen telefoon te koppelen)
3. Zet de environment variables:
   - `TWILIO_ACCOUNT_SID` en `TWILIO_AUTH_TOKEN` — te vinden op je
     Twilio-dashboard
   - `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886` (het standaard
     sandbox-nummer; Twilio toont het exacte nummer in je dashboard)
4. Test een boeking — je zou nu een WhatsApp-bericht moeten ontvangen op
   het nummer dat je gekoppeld hebt aan de sandbox

**Belangrijke beperking:** in de gratis sandbox-modus krijgen **enkel
telefoonnummers die zelf de activatiecode stuurden** berichten — dus niet
elke willekeurige klant. Perfect om te testen, niet geschikt om
daadwerkelijk klanten te bereiken.

### Stap 2 — Echt gebruiken met klanten (na goedkeuring)

1. Vraag in Twilio een **eigen WhatsApp-afzendernummer** aan (Twilio
   begeleidt dit proces, inclusief de Meta-bedrijfsverificatie)
2. Maak in Twilio's **Content Template Builder** een sjabloon aan voor elk
   bericht (bevestiging, aanvraag, herinnering) en laat die goedkeuren door
   Meta
3. Vervang in dat geval `TWILIO_WHATSAPP_FROM` door je eigen goedgekeurde
   nummer
4. Voor de sjablonen zelf: de teksten staan nu in
   `src/lib/whatsapp.ts` als eenvoudige berichten; zodra je goedgekeurde
   sjabloon-ID's (Content SID's) hebt van Twilio, kan ik de code aanpassen
   om die te gebruiken in plaats van vrije tekst — dat is een kleine
   aanpassing zodra je zover bent.

### Wat werkt er al, zodra geconfigureerd?

- Bevestiging (of aanvraag-melding) bij het boeken — automatisch naar het
  GSM-nummer dat de klant invulde
- Beide herinneringen (lang + kort, zie Instellingen → Herinneringen) —
  automatisch via dezelfde cron-aanroep als de e-mailherinneringen

## Nog aan te passen voor een echte lancering

- **QR-betaling**: upload je eigen Payconiq/Bancontact QR-afbeelding via
  Instellingen → QR-betaling. Deze verschijnt automatisch aan de kassa
  zodra je "QR-code" kiest als betaalwijze.
- **Duur per dienst**: momenteel een inschatting per type behandeling,
  aanpasbaar via Instellingen → Diensten & prijzen.
- Test de PWA-installatie op een echte telefoon (Safari/Chrome → "Zet op
  beginscherm"). De iconen en manifest staan klaar (`public/icon-192.png`,
  `public/icon-512.png`, `public/apple-touch-icon.png`).

## E-mailbevestigingen en -herinneringen

E-mails zijn ingebouwd maar **staan standaard uit** totdat je ze
configureert (dan doet de rest van de app het gewoon verder, er wordt enkel
een regel gelogd dat de mail niet verzonden is).

Om ze aan te zetten:

1. Maak een gratis account op [resend.com](https://resend.com) en verifieer
   je eigen domein (of gebruik hun test-adres om snel te proberen).
2. Zet de environment variables:
   - `RESEND_API_KEY` — je API-key van Resend
   - `RESEND_FROM_EMAIL` — bv. `Doeëg Mêin Haore <afspraken@jouwdomein.be>`
3. Klanten die een e-mailadres invullen krijgen automatisch een
   bevestigings- of aanvraagmail bij het boeken.
4. Voor de **herinneringen** (standaard 24u + 2u op voorhand, instelbaar
   via Instellingen) moet je regelmatig — bij voorkeur **elk uur** — deze
   URL laten aanroepen:
   ```
   GET https://jouw-domein.be/api/cron/reminders?secret=JOUW_CRON_SECRET
   ```
   Zet eerst `CRON_SECRET` in je environment variables op een eigen
   geheime waarde. Laat deze URL elk uur aanroepen via:
   - een gratis externe cron-dienst zoals [cron-job.org](https://cron-job.org), of
   - de ingebouwde cron-functie van Railway/Render, indien beschikbaar.

   Hoe vaker dit draait, hoe preciezer de "X uur op voorhand"-herinnering
   aansluit bij de werkelijk ingestelde tijd; 1x per dag is te grof voor
   een herinnering die bv. 2 uur op voorhand moet gaan.

## Projectstructuur (kort)

```
src/
  app/
    page.tsx              → publieke homepage
    boeken/                → boekingsflow (klant)
    admin/                 → beheeromgeving (Jelle)
    api/                   → alle backend-routes
  lib/
    db.ts                  → JSON-bestand databaselaag
    types.ts               → datamodel
    seed.ts                → vult de prijslijst automatisch in bij eerste start
    availability.ts         → berekent vrije tijdsloten
    tz.ts                   → tijdzone-veilige hulpfuncties (Europe/Brussels)
    auth.ts                 → sessie/login voor het adminluik
data/
  db.json                  → alle echte gegevens (wordt automatisch aangemaakt)
```
