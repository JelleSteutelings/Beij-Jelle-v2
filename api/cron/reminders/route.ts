import { NextRequest, NextResponse } from "next/server";
import { mutateDB } from "@/lib/db";
import { sendEmail, bookingReminderEmail } from "@/lib/email";
import { sendWhatsApp, bookingReminderWhatsApp } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * Bedoeld om regelmatig extern aangeroepen te worden — bij voorkeur elk uur
 * (bv. via een gratis cron-service zoals cron-job.org, of Vercel/Railway
 * Cron). Hoe vaker dit draait, hoe preciezer de "X uur op voorhand"
 * herinnering aansluit bij de werkelijk ingestelde tijd.
 *
 * Verstuurt twee soorten herinneringen per afspraak:
 *  - een "lange" herinnering (standaard 24u op voorhand, instelbaar)
 *  - een "korte" herinnering (standaard 2u op voorhand, instelbaar)
 * Elke klant kan hiervan afwijken via een persoonlijke instelling.
 *
 * Beveiligd met een gedeeld geheim:
 *   GET /api/cron/reminders?secret=JOUW_CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Ongeldig of ontbrekend secret" }, { status: 401 });
  }

  const now = new Date();
  const sent: { bookingId: string; kind: "long" | "short" }[] = [];

  await mutateDB((db) => {
    const upcoming = db.bookings.filter(
      (b) => b.status === "confirmed" && new Date(b.start).getTime() > now.getTime()
    );

    for (const booking of upcoming) {
      const customer = db.customers.find((c) => c.id === booking.customerId);
      const service = db.services.find((s) => s.id === booking.serviceId);
      if (!customer || !service) continue;

      const longHours =
        customer.reminderLongHoursOverride ?? db.settings.reminderLongHours;
      const shortHours =
        customer.reminderShortHoursOverride ?? db.settings.reminderShortHours;

      const startTime = new Date(booking.start).getTime();
      const longTriggerTime = startTime - longHours * 60 * 60 * 1000;
      const shortTriggerTime = startTime - shortHours * 60 * 60 * 1000;

      const dateLabel = new Date(booking.start).toLocaleDateString("nl-BE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Europe/Brussels",
      });
      const timeLabel = new Date(booking.start).toLocaleTimeString("nl-BE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Brussels",
      });
      const address = `${db.settings.address}, ${db.settings.postalCity}`;

      // Lange herinnering (bv. "morgen" / een dag op voorhand)
      if (
        longHours > 0 &&
        !booking.remindedLongAt &&
        now.getTime() >= longTriggerTime &&
        now.getTime() < startTime
      ) {
        const leadLabel =
          longHours >= 20 && longHours <= 28 ? "morgen" : `over ongeveer ${longHours} uur`;
        if (customer.email) {
          sendEmail({
            to: customer.email,
            subject: `Herinnering: je afspraak ${leadLabel} bij ${db.settings.businessName}`,
            html: bookingReminderEmail({
              businessName: db.settings.businessName,
              customerName: customer.name,
              serviceName: service.name,
              dateLabel,
              timeLabel,
              address,
              leadTimeLabel: leadLabel,
            }),
          }).catch(() => {});
        }
        sendWhatsApp({
          to: customer.phone,
          body: bookingReminderWhatsApp({
            businessName: db.settings.businessName,
            customerName: customer.name,
            serviceName: service.name,
            dateLabel,
            timeLabel,
            leadTimeLabel: leadLabel,
          }),
        }).catch(() => {});
        booking.remindedLongAt = now.toISOString();
        sent.push({ bookingId: booking.id, kind: "long" });
      }

      // Korte herinnering (bv. 2 uur op voorhand)
      if (
        shortHours > 0 &&
        !booking.remindedShortAt &&
        now.getTime() >= shortTriggerTime &&
        now.getTime() < startTime
      ) {
        const leadLabel = `over ongeveer ${shortHours} uur`;
        if (customer.email) {
          sendEmail({
            to: customer.email,
            subject: `Herinnering: je afspraak straks bij ${db.settings.businessName}`,
            html: bookingReminderEmail({
              businessName: db.settings.businessName,
              customerName: customer.name,
              serviceName: service.name,
              dateLabel,
              timeLabel,
              address,
              leadTimeLabel: leadLabel,
            }),
          }).catch(() => {});
        }
        sendWhatsApp({
          to: customer.phone,
          body: bookingReminderWhatsApp({
            businessName: db.settings.businessName,
            customerName: customer.name,
            serviceName: service.name,
            dateLabel,
            timeLabel,
            leadTimeLabel: leadLabel,
          }),
        }).catch(() => {});
        booking.remindedShortAt = now.toISOString();
        sent.push({ bookingId: booking.id, kind: "short" });
      }
    }

    return sent;
  });

  return NextResponse.json({ ok: true, remindersSent: sent.length, details: sent });
}
