/**
 * WhatsApp-berichten versturen via Twilio (https://www.twilio.com/whatsapp).
 *
 * Werkt alleen als TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN en
 * TWILIO_WHATSAPP_FROM zijn ingesteld. Zonder configuratie doet dit niets
 * (logt enkel een regel) — de rest van de app blijft gewoon werken.
 *
 * BELANGRIJK — lees dit voor je dit in productie gebruikt:
 * WhatsApp laat bedrijven niet zomaar vrije tekstberichten sturen naar
 * klanten. Een bericht dat JIJ start (zoals een afspraakherinnering,
 * buiten een gesprek dat de klant zelf begon) moet volgens WhatsApp's
 * regels via een vooraf goedgekeurde "message template" verlopen. Dat
 * goedkeuringsproces loopt via Meta/WhatsApp Business (met
 * bedrijfsverificatie) en kan enkele dagen duren. Dit bestand stuurt
 * voorlopig vrije tekst — perfect om te testen in Twilio's gratis
 * WhatsApp Sandbox, maar voor echt gebruik met klanten moet je een
 * goedgekeurde template aanmaken in Twilio Content Template Builder en
 * TWILIO_WHATSAPP_TEMPLATE_SID instellen (zie README).
 */
export async function sendWhatsApp(opts: {
  to: string; // gewoon telefoonnummer, bv. "+32499123456"
  body: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // bv. "whatsapp:+14155238886"

  if (!accountSid || !authToken || !from) {
    console.log(
      "[whatsapp] Twilio niet geconfigureerd — bericht niet verzonden naar:",
      opts.to
    );
    return { sent: false, reason: "not_configured" };
  }

  const toNumber = opts.to.startsWith("whatsapp:") ? opts.to : `whatsapp:${opts.to}`;

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const params = new URLSearchParams({
      From: from,
      To: toNumber,
      Body: opts.body,
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("[whatsapp] Twilio gaf een fout:", res.status, text);
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[whatsapp] Kon geen verbinding maken met Twilio:", err);
    return { sent: false, reason: "network_error" };
  }
}

export function bookingConfirmedWhatsApp(opts: {
  businessName: string;
  customerName: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
}) {
  return `Hoi ${opts.customerName}! Je afspraak bij ${opts.businessName} is bevestigd: ${opts.serviceName} op ${opts.dateLabel} om ${opts.timeLabel}. Tot binnenkort!`;
}

export function bookingPendingWhatsApp(opts: {
  businessName: string;
  customerName: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
}) {
  return `Hoi ${opts.customerName}, je aanvraag voor ${opts.serviceName} op ${opts.dateLabel} om ${opts.timeLabel} bij ${opts.businessName} is ontvangen. Dit valt buiten de gebruikelijke uren, we nemen persoonlijk contact op om te bevestigen.`;
}

export function bookingReminderWhatsApp(opts: {
  businessName: string;
  customerName: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
  leadTimeLabel: string;
}) {
  return `Hoi ${opts.customerName}, kleine herinnering: je afspraak (${opts.serviceName}) bij ${opts.businessName} is ${opts.leadTimeLabel}, op ${opts.dateLabel} om ${opts.timeLabel}. Tot dan!`;
}
