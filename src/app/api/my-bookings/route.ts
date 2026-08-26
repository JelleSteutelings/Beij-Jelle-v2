import { NextRequest, NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { sendEmail, bookingsOverviewEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Stuurt (indien het e-mailadres bij een klant hoort) een overzicht van de
 * eerstvolgende afspraken per e-mail. Geeft bewust altijd hetzelfde
 * antwoord terug, ongeacht of het e-mailadres gekend is — zo kan niemand
 * via deze weg nagaan welke e-mailadressen wel/niet klant zijn, en wordt
 * er nooit rechtstreeks afsprakendata op het scherm getoond (GDPR-vriendelijker).
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !email.trim()) {
    return NextResponse.json({ error: "Geef een e-mailadres op." }, { status: 400 });
  }

  const db = readDB();
  const normalized = email.trim().toLowerCase();
  const customer = db.customers.find(
    (c) => c.email && c.email.trim().toLowerCase() === normalized
  );

  if (customer) {
    const now = new Date();
    const upcoming = db.bookings
      .filter(
        (b) =>
          b.customerId === customer.id &&
          (b.status === "confirmed" || b.status === "pending") &&
          new Date(b.start).getTime() > now.getTime()
      )
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    if (upcoming.length > 0) {
      const bookingsForEmail = upcoming.map((b) => {
        const service = db.services.find((s) => s.id === b.serviceId);
        return {
          serviceName: service?.name || "Afspraak",
          dateLabel: new Date(b.start).toLocaleDateString("nl-BE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "Europe/Brussels",
          }),
          timeLabel: new Date(b.start).toLocaleTimeString("nl-BE", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Brussels",
          }),
          pending: b.status === "pending",
        };
      });

      sendEmail({
        to: customer.email!,
        subject: `Jouw afspraken bij ${db.settings.businessName}`,
        html: bookingsOverviewEmail({
          businessName: db.settings.businessName,
          customerName: customer.name,
          bookings: bookingsForEmail,
        }),
      }).catch(() => {});
    }
  }

  // Altijd hetzelfde, generieke antwoord — ook als er geen klant of geen
  // afspraken gevonden werden.
  return NextResponse.json({ ok: true });
}
