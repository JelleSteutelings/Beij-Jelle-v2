import { NextRequest, NextResponse } from "next/server";
import { readDB, mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const db = readDB();
  return NextResponse.json(db.customers);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json();
  const result = await mutateDB((db) => {
    const normalizedPhone = normalizePhone(body.phone);
    const existing = db.customers.find(
      (c) => normalizePhone(c.phone) === normalizedPhone
    );

    if (existing) {
      // Klant bestaat al (zelfde nummer) — gegevens aanvullen i.p.v. dupliceren.
      if (body.name) existing.name = body.name;
      if (body.email) existing.email = body.email;
      if (body.address) existing.address = body.address;
      if (body.notes) existing.notes = body.notes;
      return { customer: existing, existed: true };
    }

    const c = {
      id: genId("cus"),
      name: body.name,
      phone: body.phone,
      email: body.email || "",
      address: body.address || "",
      notes: body.notes || "",
      createdAt: new Date().toISOString(),
    };
    db.customers.push(c);
    return { customer: c, existed: false };
  });
  return NextResponse.json(result);
}
