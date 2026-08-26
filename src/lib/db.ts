import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { DB } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function defaultDB(): DB {
  return {
    services: [],
    customers: [],
    bookings: [],
    products: [],
    stockMovements: [],
    purchaseOrders: [],
    giftVouchers: [],
    noShowRecords: [],
    cancellationRecords: [],
    correctionRecords: [],
    sales: [],
    dayClosings: [],
    settings: {
      businessName: "Doeëg Mêin Haore",
      ownerName: "Jelle Steutelings",
      address: "Rode Kruisstraat 1",
      postalCity: "3650 Stokkem",
      phone: "+32 478 05 88 02",
      vatNumber: "",
      bankAccountNumber: "",
      facebookUrl: "",
      instagramUrl: "",
      openingHours: {
        mon: [{ start: "13:00", end: "19:00" }],
        tue: [],
        wed: [{ start: "08:00", end: "19:00" }],
        thu: [{ start: "08:00", end: "19:00" }],
        fri: [{ start: "08:00", end: "19:00" }],
        sat: [{ start: "08:00", end: "17:00" }],
        sun: [],
      },
      reminderLongHours: 24,
      reminderShortHours: 2,
      adminPasswordHash: bcrypt.hashSync("jelle2026", 10),
      slotStepMinutes: 15,
      studentDiscountPercent: 10,
    },
  };
}

function ensureDB(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB(), null, 2));
  }
}

export function readDB(): DB {
  ensureDB();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  const db = JSON.parse(raw) as DB;
  // Migratie: oudere db.json-bestanden hebben deze velden nog niet.
  if (!db.stockMovements) db.stockMovements = [];
  if (!db.purchaseOrders) db.purchaseOrders = [];
  if (!db.giftVouchers) db.giftVouchers = [];
  if (!db.noShowRecords) db.noShowRecords = [];
  if (!db.cancellationRecords) db.cancellationRecords = [];
  if (!db.correctionRecords) db.correctionRecords = [];
  if (!db.dayClosings) db.dayClosings = [];
  db.products.forEach((p, i) => {
    if (p.order === undefined) p.order = i;
  });
  if (db.settings.reminderLongHours === undefined) db.settings.reminderLongHours = 24;
  if (db.settings.reminderShortHours === undefined) db.settings.reminderShortHours = 2;
  if (db.settings.studentDiscountPercent === undefined) db.settings.studentDiscountPercent = 10;
  return db;
}

export function writeDB(db: DB): Promise<void> {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  return Promise.resolve();
}

export function mutateDB<T>(fn: (db: DB) => T): Promise<T> {
  const db = readDB();
  const result = fn(db);
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  return Promise.resolve(result);
}

export function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
