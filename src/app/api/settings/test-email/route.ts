import { NextRequest, NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const { to } = await req.json();
  if (!to || !to.trim()) {
    return NextResponse.json({ error: "Geef een e-mailadres op." }, { status: 400 });
  }

  const settings = readDB().settings;
  const result = await sendEmail({
    to: to.trim(),
    subject: `Testmail van ${settings.businessName}`,
    html: `
      <div style="font-family: sans-serif; color: #241318; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #a9701f;">Testmail</h2>
        <p>Dit is een testbericht vanuit het boekingsplatform van ${settings.businessName}.</p>
        <p>Kwam dit aan? Dan werkt de e-mailinstelling correct.</p>
      </div>
    `,
  });

  if (!result.sent) {
    return NextResponse.json(
      { error: `Niet verzonden (${result.reason || "onbekende reden"}). Controleer RESEND_API_KEY en RESEND_FROM_EMAIL op Railway.` },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
