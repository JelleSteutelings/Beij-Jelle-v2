import { NextRequest, NextResponse } from "next/server";
import { mutateDB, readDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { computeAvailableSlots, hasConflict, getServiceBlocks, totalBlocksDuration, buildBookingBlocks } from "@/lib/availability";
import { normalizePhone } from "@/lib/phone";
import {
  sendEmail,
  bookingConfirmedEmail,
  bookingPendingEmail,
} from "@/lib/email";
import {
  sendWhatsApp,
  bookingConfirmedWhatsApp,
  bookingPendingWhatsApp,
} from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const db = readDB();
  return NextResponse.json(db.bookings);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { serviceId, start, customer, notes } = body as {
    serviceId: string;
    start: string; // ISO
    customer: { name: string; phone: string; email?: string; address?: string };
    notes?: string;
  };

  if (!serviceId || !start || !customer?.name || !customer?.phone) {
    return NextResponse.json(
      { error: "Vul dienst, tijdstip, naam en telefoonnummer in." },
      { status: 400 }
    );
  }

  const result = await mutateDB((db) => {
    const service = db.services.find((s) => s.id === serviceId && s.active);
    if (!service) {
      return { error: "Deze dienst bestaat niet (meer)." };
    }

    const dateStr = start.slice(0, 10);
    const blocks = getServiceBlocks(service);
    const validSlots = computeAvailableSlots(
      dateStr,
      blocks,
      db.settings.openingHours,
      db.settings.slotStepMinutes,
      db.bookings
    );
    const isWithinUsualSlots = validSlots.includes(start);

    // Buiten de gebruikelijke uren mag ook, maar dan enkel als aanvraag
    // (Jelle bevestigt manueel) en alleen als het echt vrij is.
    if (!isWithinUsualSlots) {
      if (hasConflict(start, blocks, db.bookings)) {
        return {
          error:
            "Dit tijdstip botst met een andere afspraak. Kies een ander moment.",
        };
      }
    }

    // find or create customer (match op genormaliseerd telefoonnummer, zodat
    // "+32 499 12 34 56" en "0499123456" als hetzelfde nummer herkend worden)
    const normalizedPhone = normalizePhone(customer.phone);
    let existingCustomer = db.customers.find(
      (c) => normalizePhone(c.phone) === normalizedPhone
    );
    if (!existingCustomer) {
      existingCustomer = {
        id: genId("cus"),
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        createdAt: new Date().toISOString(),
      };
      db.customers.push(existingCustomer);
    } else {
      if (customer.email && !existingCustomer.email) existingCustomer.email = customer.email;
      if (customer.address && !existingCustomer.address) existingCustomer.address = customer.address;
    }

    const startDate = new Date(start);
    const totalDuration = totalBlocksDuration(blocks);
    const endDate = new Date(startDate.getTime() + totalDuration * 60000);

    const booking = {
      id: genId("bkg"),
      serviceId: service.id,
      customerId: existingCustomer.id,
      customerName: existingCustomer.name,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      status: (isWithinUsualSlots ? "confirmed" : "pending") as
        | "confirmed"
        | "pending",
      notes: notes || "",
      blocks: buildBookingBlocks(blocks),
      createdAt: new Date().toISOString(),
    };
    db.bookings.push(booking);
    return { booking, service, isWithinUsualSlots };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  // Bevestiging (of aanvraag-melding) sturen via e-mail en/of WhatsApp.
  // Dit blokkeert de reactie aan de klant niet als het misgaat.
  const settings = readDB().settings;
  const dateLabel = new Date(result.booking.start).toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Brussels",
  });
  const timeLabel = new Date(result.booking.start).toLocaleTimeString("nl-BE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels",
  });

  if (customer.email) {
    const emailPromise = result.isWithinUsualSlots
      ? sendEmail({
          to: customer.email,
          subject: `Afspraak bevestigd bij ${settings.businessName}`,
          html: bookingConfirmedEmail({
            businessName: settings.businessName,
            customerName: customer.name,
            serviceName: result.service.name,
            dateLabel,
            timeLabel,
            address: `${settings.address}, ${settings.postalCity}`,
            phone: settings.phone,
          }),
        })
      : sendEmail({
          to: customer.email,
          subject: `Aanvraag ontvangen bij ${settings.businessName}`,
          html: bookingPendingEmail({
            businessName: settings.businessName,
            customerName: customer.name,
            serviceName: result.service.name,
            dateLabel,
            timeLabel,
          }),
        });

    emailPromise.catch(() => {});
  }

  const whatsappBody = result.isWithinUsualSlots
    ? bookingConfirmedWhatsApp({
        businessName: settings.businessName,
        customerName: customer.name,
        serviceName: result.service.name,
        dateLabel,
        timeLabel,
      })
    : bookingPendingWhatsApp({
        businessName: settings.businessName,
        customerName: customer.name,
        serviceName: result.service.name,
        dateLabel,
        timeLabel,
      });
  sendWhatsApp({ to: customer.phone, body: whatsappBody }).catch(() => {});

  return NextResponse.json(result);
}
