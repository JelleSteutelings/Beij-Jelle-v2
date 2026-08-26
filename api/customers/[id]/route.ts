import { NextRequest, NextResponse } from "next/server";
import { readDB, mutateDB } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const db = readDB();
  const customer = db.customers.find((c) => c.id === params.id);
  if (!customer) {
    return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  }
  const bookings = db.bookings
    .filter((b) => b.customerId === params.id)
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  const sales = db.sales.filter((s) => s.customerId === params.id);
  const noShowRecords = db.noShowRecords
    .filter((r) => r.customerId === params.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const cancellationRecords = db.cancellationRecords
    .filter((r) => r.customerId === params.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return NextResponse.json({ customer, bookings, sales, noShowRecords, cancellationRecords });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  await mutateDB((db) => {
    db.customers = db.customers.filter((c) => c.id !== params.id);
  });
  return NextResponse.json({ ok: true });
}
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const updates = await req.json();
  const result = await mutateDB((db) => {
    const customer = db.customers.find((c) => c.id === params.id);
    if (!customer) return { error: "Klant niet gevonden" };
    Object.assign(customer, updates);
    return { customer };
  });
  if ("error" in result) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result.customer);
}
