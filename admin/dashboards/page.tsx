"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Booking,
  Customer,
  GiftVoucher,
  NoShowRecord,
  Product,
  Sale,
  Service,
} from "@/lib/types";
import {
  Period,
  bucketKeyForDate,
  bucketLabelsFor,
  computeRange,
  shiftRefDate,
  todayStr,
} from "@/lib/dashboardDates";
import { toBrusselsDateString } from "@/lib/tz";
import BarChart from "./BarChart";

const HOUR_RANGE = Array.from({ length: 15 }, (_, i) => i + 7); // 07u..21u

function eur(n: number) {
  return `€${n.toFixed(2)}`;
}

export default function DashboardsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [refDate, setRefDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [giftVouchers, setGiftVouchers] = useState<GiftVoucher[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [noShowRecords, setNoShowRecords] = useState<NoShowRecord[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/bookings").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/sales").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/gift-vouchers").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/no-show-records").then((r) => r.json()),
    ]).then(([b, s, sa, p, gv, c, ns]) => {
      setBookings(b);
      setServices(s);
      setSales(sa);
      setProducts(p);
      setGiftVouchers(gv);
      setCustomers(c);
      setNoShowRecords(ns);
      setLoading(false);
    });
  }, []);

  const range = useMemo(() => computeRange(period, refDate), [period, refDate]);

  const serviceById = (id: string | null) => services.find((s) => s.id === id) || null;
  const customerById = (id?: string) => customers.find((c) => c.id === id) || null;

  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= range.start.getTime() && t < range.end.getTime();
  };

  const bookingsInRange = useMemo(
    () => bookings.filter((b) => inRange(b.start)),
    [bookings, range]
  );
  const realizedBookings = useMemo(
    () => bookingsInRange.filter((b) => b.status === "confirmed" || b.status === "done"),
    [bookingsInRange]
  );
  const salesInRange = useMemo(() => sales.filter((s) => inRange(s.createdAt)), [sales, range]);
  const vouchersIssuedInRange = useMemo(
    () => giftVouchers.filter((v) => inRange(v.issuedAt)),
    [giftVouchers, range]
  );
  const noShowsInRange = useMemo(
    () => noShowRecords.filter((r) => inRange(r.date)),
    [noShowRecords, range]
  );
  const newCustomersInRange = useMemo(
    () => customers.filter((c) => inRange(c.createdAt)),
    [customers, range]
  );

  // --- 1. Drukte per uur ---
  const busynessByHour = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const b of realizedBookings) {
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Brussels",
          hour: "2-digit",
          hour12: false,
        }).format(new Date(b.start))
      );
      counts[hour] = (counts[hour] || 0) + 1;
    }
    return HOUR_RANGE.map((h) => ({ label: `${h}u`, value: counts[h] || 0 }));
  }, [realizedBookings]);

  // --- 2. Omzet ---
  const serviceProductRevenue = salesInRange.reduce((sum, s) => sum + s.total, 0);
  const paidVoucherRevenue = vouchersIssuedInRange
    .filter((v) => v.origin === "paid")
    .reduce((sum, v) => sum + v.originalAmount, 0);
  const totalRevenue = serviceProductRevenue + paidVoucherRevenue;

  const revenueByPayment = useMemo(() => {
    const byMethod: Record<string, number> = { cash: 0, qr: 0, voucher: 0 };
    for (const s of salesInRange) {
      byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] || 0) + s.total;
    }
    return byMethod;
  }, [salesInRange]);

  const revenueTrend = useMemo(() => {
    const buckets = bucketLabelsFor(period, range.start, range.end);
    const sums: Record<string, number> = {};
    for (const s of salesInRange) {
      const key = bucketKeyForDate(period, s.createdAt);
      sums[key] = (sums[key] || 0) + s.total;
    }
    for (const v of vouchersIssuedInRange.filter((v) => v.origin === "paid")) {
      const key = bucketKeyForDate(period, v.issuedAt);
      sums[key] = (sums[key] || 0) + v.originalAmount;
    }
    return buckets.map((b) => ({ label: b.label, value: sums[b.key] || 0 }));
  }, [period, range, salesInRange, vouchersIssuedInRange]);

  // --- 3. Productverkoop ---
  const productSales = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const s of salesInRange) {
      for (const item of s.items) {
        if (item.type !== "product") continue;
        if (!map[item.refId]) map[item.refId] = { name: item.name, qty: 0, revenue: 0 };
        map[item.refId].qty += item.qty;
        map[item.refId].revenue += item.price * item.qty;
      }
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [salesInRange]);

  // --- 4. Diensten-categorieën ---
  const categoryBreakdown = useMemo(() => {
    let kleuringVrouwen = 0;
    let snitVrouwen = 0;
    let brushingVrouwen = 0;
    let snitHeren = 0;
    const herenSnitDays = new Set<string>();
    const baardDays = new Set<string>();

    for (const b of realizedBookings) {
      const service = serviceById(b.serviceId);
      if (!service) continue;
      const dayKey = `${b.customerId}_${toBrusselsDateString(new Date(b.start))}`;

      if (service.category === "Kleuring") kleuringVrouwen++;
      if (service.name === "Snit kort" || service.name === "Snit lang") snitVrouwen++;
      if (service.name === "Brushing kort" || service.name === "Brushing lang") brushingVrouwen++;
      if (service.name === "Heren snit") {
        snitHeren++;
        herenSnitDays.add(dayKey);
      }
      if (service.name === "Baard") baardDays.add(dayKey);
    }

    let snitHerenEnBaard = 0;
    herenSnitDays.forEach((key) => {
      if (baardDays.has(key)) snitHerenEnBaard++;
    });

    const studenten = salesInRange.filter((s) => s.studentDiscount).length;
    const cadeaubonsUitgegeven = vouchersIssuedInRange.length;
    const cadeaubonsGebruikt = salesInRange.filter((s) => s.giftVoucherAmountUsed).length;

    return {
      kleuringVrouwen,
      snitVrouwen,
      brushingVrouwen,
      snitHeren,
      snitHerenEnBaard,
      studenten,
      cadeaubonsUitgegeven,
      cadeaubonsGebruikt,
    };
  }, [realizedBookings, services, salesInRange, vouchersIssuedInRange]);

  // --- 5. Bonus ---
  const noShowRate =
    noShowsInRange.length + realizedBookings.length > 0
      ? (noShowsInRange.length / (noShowsInRange.length + realizedBookings.length)) * 100
      : 0;

  const topClients = useMemo(() => {
    const byCustomer: Record<string, number> = {};
    for (const s of salesInRange) {
      if (!s.customerId) continue;
      byCustomer[s.customerId] = (byCustomer[s.customerId] || 0) + s.total;
    }
    return Object.entries(byCustomer)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([customerId, total]) => ({
        name: customerById(customerId)?.name || "Onbekend",
        total,
      }));
  }, [salesInRange, customers]);

  const lowStockProducts = products.filter((p) => p.stock <= p.minStock);
  const avgSpend =
    salesInRange.length > 0 ? serviceProductRevenue / salesInRange.length : 0;

  return (
    <div className="p-6 sm:p-10 max-w-4xl">
      <h1 className="font-display text-2xl mb-1">Dashboards</h1>
      <p className="text-cream/40 text-sm mb-6">Inzicht in drukte, omzet en verkoop</p>

      {/* PERIODE-SELECTOR */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="flex gap-1.5">
          {(["dag", "week", "maand", "jaar"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-3.5 py-1.5 rounded-full border transition capitalize ${
                period === p
                  ? "bg-gold-gradient text-deep font-semibold border-transparent"
                  : "border-hairline text-cream/60 hover:border-gold"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefDate((d) => shiftRefDate(period, d, -1))}
            className="w-8 h-8 rounded-full border border-hairline hover:border-gold transition"
          >
            &larr;
          </button>
          <span className="text-sm text-cream/70 min-w-[10rem] text-center">{range.label}</span>
          <button
            onClick={() => setRefDate((d) => shiftRefDate(period, d, 1))}
            className="w-8 h-8 rounded-full border border-hairline hover:border-gold transition"
          >
            &rarr;
          </button>
        </div>
        <button
          onClick={() => setRefDate(todayStr())}
          className="text-xs text-gold/80 hover:text-gold"
        >
          Vandaag
        </button>
      </div>

      {loading ? (
        <p className="text-cream/40 text-sm">Laden...</p>
      ) : (
        <div className="space-y-10">
          {/* DRUKTE */}
          <section>
            <h2 className="font-display text-lg text-gold mb-1">Drukte</h2>
            <p className="text-xs text-cream/40 mb-4">
              Aantal afspraken per uur, {range.label.toLowerCase()}
            </p>
            <BarChart data={busynessByHour} />
          </section>

          <div className="snip-divider max-w-md" />

          {/* OMZET */}
          <section>
            <h2 className="font-display text-lg text-gold mb-4">Omzet</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="border border-hairline rounded-xl p-3 bg-panel/30">
                <p className="text-[11px] text-cream/40 mb-1">Totale omzet</p>
                <p className="font-display text-gold-light text-lg">{eur(totalRevenue)}</p>
              </div>
              <div className="border border-hairline rounded-xl p-3 bg-panel/30">
                <p className="text-[11px] text-cream/40 mb-1">Cash</p>
                <p className="font-display text-gold-light text-lg">
                  {eur(revenueByPayment.cash || 0)}
                </p>
              </div>
              <div className="border border-hairline rounded-xl p-3 bg-panel/30">
                <p className="text-[11px] text-cream/40 mb-1">QR-code</p>
                <p className="font-display text-gold-light text-lg">
                  {eur(revenueByPayment.qr || 0)}
                </p>
              </div>
              <div className="border border-hairline rounded-xl p-3 bg-panel/30">
                <p className="text-[11px] text-cream/40 mb-1">Cadeaubon verkocht</p>
                <p className="font-display text-gold-light text-lg">{eur(paidVoucherRevenue)}</p>
              </div>
            </div>
            <BarChart data={revenueTrend} formatValue={eur} />
          </section>

          <div className="snip-divider max-w-md" />

          {/* PRODUCTVERKOOP */}
          <section>
            <h2 className="font-display text-lg text-gold mb-4">Productverkoop</h2>
            {productSales.length === 0 ? (
              <p className="text-cream/40 text-sm">Geen producten verkocht in deze periode.</p>
            ) : (
              <ul className="space-y-1.5">
                {productSales.map((p) => (
                  <li
                    key={p.name}
                    className="flex justify-between items-center px-3 py-2 rounded-lg border border-hairline bg-panel/30 text-sm"
                  >
                    <span className="text-cream/80">{p.name}</span>
                    <span className="text-cream/50 text-xs">{p.qty}&times; verkocht</span>
                    <span className="font-display text-gold-light">{eur(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="snip-divider max-w-md" />

          {/* DIENSTEN-CATEGORIEEN */}
          <section>
            <h2 className="font-display text-lg text-gold mb-4">Diensten-overzicht</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Kleuringen vrouwen", value: categoryBreakdown.kleuringVrouwen },
                { label: "Snit vrouwen", value: categoryBreakdown.snitVrouwen },
                { label: "Brushing vrouwen", value: categoryBreakdown.brushingVrouwen },
                { label: "Snit heren", value: categoryBreakdown.snitHeren },
                { label: "Snit heren + baard", value: categoryBreakdown.snitHerenEnBaard },
                { label: "Studenten", value: categoryBreakdown.studenten },
                { label: "Cadeaubon uitgegeven", value: categoryBreakdown.cadeaubonsUitgegeven },
                { label: "Cadeaubon gebruikt", value: categoryBreakdown.cadeaubonsGebruikt },
              ].map((item) => (
                <div
                  key={item.label}
                  className="border border-hairline rounded-xl p-3 bg-panel/30"
                >
                  <p className="text-[11px] text-cream/40 mb-1">{item.label}</p>
                  <p className="font-display text-gold-light text-xl">{item.value}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-cream/30 mt-3">
              &ldquo;Snit heren + baard&rdquo; telt klanten die op dezelfde dag zowel een
              herensnit als een baardbehandeling hadden.
            </p>
          </section>

          <div className="snip-divider max-w-md" />

          {/* BONUS INZICHTEN */}
          <section>
            <h2 className="font-display text-lg text-gold mb-1">Extra inzichten</h2>
            <p className="text-xs text-cream/40 mb-4">Enkele bijkomende dashboards</p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="border border-hairline rounded-xl p-4 bg-panel/30">
                <p className="text-xs text-gold/80 uppercase tracking-wide mb-2">
                  No-show percentage
                </p>
                <p className="font-display text-2xl text-gold-light mb-1">
                  {noShowRate.toFixed(1)}%
                </p>
                <p className="text-[11px] text-cream/40">
                  {noShowsInRange.length} no-shows op{" "}
                  {noShowsInRange.length + realizedBookings.length} afspraken
                </p>
              </div>

              <div className="border border-hairline rounded-xl p-4 bg-panel/30">
                <p className="text-xs text-gold/80 uppercase tracking-wide mb-2">
                  Gemiddelde besteding
                </p>
                <p className="font-display text-2xl text-gold-light mb-1">{eur(avgSpend)}</p>
                <p className="text-[11px] text-cream/40">per kassaverkoop, deze periode</p>
              </div>

              <div className="border border-hairline rounded-xl p-4 bg-panel/30">
                <p className="text-xs text-gold/80 uppercase tracking-wide mb-2">
                  Nieuwe klanten
                </p>
                <p className="font-display text-2xl text-gold-light mb-1">
                  {newCustomersInRange.length}
                </p>
                <p className="text-[11px] text-cream/40">voor het eerst geboekt deze periode</p>
              </div>

              <div className="border border-hairline rounded-xl p-4 bg-panel/30">
                <p className="text-xs text-gold/80 uppercase tracking-wide mb-2">
                  Top klanten (besteding)
                </p>
                {topClients.length === 0 ? (
                  <p className="text-xs text-cream/40">Nog geen verkopen deze periode.</p>
                ) : (
                  <ul className="space-y-1">
                    {topClients.map((c, i) => (
                      <li key={i} className="flex justify-between text-sm">
                        <span className="text-cream/70">{c.name}</span>
                        <span className="text-gold-light font-display">{eur(c.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {lowStockProducts.length > 0 && (
              <div className="mt-4 border border-amber-700/50 bg-amber-950/20 rounded-xl p-4">
                <p className="text-xs text-amber-300 uppercase tracking-wide mb-2">
                  Voorraad bijna op (nu, niet periode-gebonden)
                </p>
                <ul className="space-y-1">
                  {lowStockProducts.map((p) => (
                    <li key={p.id} className="flex justify-between text-sm text-amber-200">
                      <span>{p.name}</span>
                      <span>
                        {p.stock} {p.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
