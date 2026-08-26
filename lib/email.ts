/**
 * Simpele e-mail helper via de Resend API (https://resend.com).
 *
 * Werkt alleen als de environment variables RESEND_API_KEY en
 * RESEND_FROM_EMAIL zijn ingesteld. Zonder configuratie doet dit niets
 * (en faalt de rest van de applicatie niet) — handig tijdens lokaal
 * ontwikkelen of als je nog geen e-mailprovider gekoppeld hebt.
 *
 * Waarom Resend? Eenvoudige REST API (één fetch-call, geen SDK nodig),
 * genereus gratis tier, en werkt goed voor transactionele mails zoals
 * boekingsbevestigingen. Je kan dit vervangen door elke andere provider
 * die een vergelijkbare REST API aanbiedt.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.log(
      "[email] RESEND_API_KEY of RESEND_FROM_EMAIL niet ingesteld — e-mail niet verzonden:",
      opts.subject,
      "->",
      opts.to
    );
    return { sent: false, reason: "not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[email] Resend gaf een fout:", res.status, text);
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] Kon geen verbinding maken met Resend:", err);
    return { sent: false, reason: "network_error" };
  }
}

export function bookingConfirmedEmail(opts: {
  businessName: string;
  customerName: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
  address: string;
  phone: string;
}) {
  return `
    <div style="font-family: sans-serif; color: #241318; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #a9701f;">Afspraak bevestigd</h2>
      <p>Hoi ${opts.customerName},</p>
      <p>Je afspraak bij <strong>${opts.businessName}</strong> staat vast:</p>
      <ul>
        <li><strong>Dienst:</strong> ${opts.serviceName}</li>
        <li><strong>Wanneer:</strong> ${opts.dateLabel} om ${opts.timeLabel}</li>
      </ul>
      <p>${opts.address}<br/>Telefoon: ${opts.phone}</p>
      <p style="color: #888; font-size: 13px;">Kan je toch niet? Bel gerust om te verzetten.</p>
    </div>
  `;
}

export function bookingPendingEmail(opts: {
  businessName: string;
  customerName: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
}) {
  return `
    <div style="font-family: sans-serif; color: #241318; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #a9701f;">Aanvraag ontvangen</h2>
      <p>Hoi ${opts.customerName},</p>
      <p>Je aanvraag voor <strong>${opts.serviceName}</strong> op ${opts.dateLabel} om ${opts.timeLabel} bij <strong>${opts.businessName}</strong> is ontvangen.</p>
      <p>Dit tijdstip valt buiten de gebruikelijke uren, dus we nemen persoonlijk contact met je op om te bevestigen.</p>
    </div>
  `;
}

export function bookingsOverviewEmail(opts: {
  businessName: string;
  customerName: string;
  bookings: { serviceName: string; dateLabel: string; timeLabel: string; pending: boolean }[];
}) {
  const rows = opts.bookings
    .map(
      (b) =>
        `<li style="margin-bottom: 8px;">
          <strong>${b.serviceName}</strong><br/>
          ${b.dateLabel} om ${b.timeLabel}${b.pending ? " <em>(aanvraag, nog te bevestigen)</em>" : ""}
        </li>`
    )
    .join("");

  return `
    <div style="font-family: sans-serif; color: #241318; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #a9701f;">Jouw eerstvolgende afspraken</h2>
      <p>Hoi ${opts.customerName},</p>
      <p>Op jouw verzoek, hier een overzicht van je eerstvolgende afspraken bij <strong>${opts.businessName}</strong>:</p>
      <ul style="padding-left: 20px;">${rows}</ul>
      <p style="color: #888; font-size: 13px;">Kan je toch niet? Bel gerust om te verzetten.</p>
    </div>
  `;
}
export function bookingReminderEmail(opts: {
  businessName: string;
  customerName: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
  address: string;
  leadTimeLabel: string; // bv. "morgen" of "over 2 uur"
}) {
  return `
    <div style="font-family: sans-serif; color: #241318; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #a9701f;">Herinnering: afspraak ${opts.leadTimeLabel}</h2>
      <p>Hoi ${opts.customerName},</p>
      <p>Kleine herinnering aan je afspraak bij <strong>${opts.businessName}</strong>:</p>
      <ul>
        <li><strong>Dienst:</strong> ${opts.serviceName}</li>
        <li><strong>Wanneer:</strong> ${opts.dateLabel} om ${opts.timeLabel}</li>
      </ul>
      <p>${opts.address}</p>
      <p style="color: #888; font-size: 13px;">Tot binnenkort!</p>
    </div>
  `;
}
