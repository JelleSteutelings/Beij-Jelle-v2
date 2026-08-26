import { NextRequest, NextResponse } from "next/server";
import { readDB, mutateDB, genId } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { seedIfEmpty } from "@/lib/seed";

export const dynamic = "force-dynamic";


export async function GET() {
  seedIfEmpty();
  const db = readDB();
  return NextResponse.json(db.services);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const body = await req.json();
  const { category, name, price, durationMinutes } = body as {
    category?: string;
    name?: string;
    price?: number;
    durationMinutes?: number;
  };

  if (!name?.trim() || !category?.trim()) {
    return NextResponse.json(
      { error: "Naam en categorie zijn verplicht." },
      { status: 400 }
    );
  }

  const result = await mutateDB((db) => {
    const service = {
      id: genId("svc"),
      category: category.trim(),
      name: name.trim(),
      price: price ?? 0,
      durationMinutes: durationMinutes ?? 30,
      active: true,
    };
    db.services.push(service);
    return service;
  });

  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const updates = await req.json(); // array of {id, price, durationMinutes, active, color?, blocks?}
  const result = await mutateDB((db) => {
    for (const u of updates) {
      const svc = db.services.find((s) => s.id === u.id);
      if (svc) {
        svc.price = u.price;
        svc.durationMinutes = u.durationMinutes;
        svc.active = u.active;
        svc.color = u.color || undefined;
        if (u.blocks && u.blocks.length > 0) {
          svc.blocks = u.blocks;
        } else {
          delete svc.blocks;
        }
      }
    }
    return db.services;
  });
  return NextResponse.json(result);
}
