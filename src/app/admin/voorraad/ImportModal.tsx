"use client";

import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type ParsedRow = Record<string, string>;

const FIELD_LABELS: Record<string, string> = {
  name: "Productnaam",
  costPrice: "Aankoopprijs",
  salePrice: "Verkoopprijs (optioneel)",
  quantity: "Aantal binnenkomend (optioneel)",
  unit: "Eenheid (optioneel)",
};

export default function ImportModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({
    name: "",
    costPrice: "",
    salePrice: "",
    quantity: "",
    unit: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);

  function guessMapping(hdrs: string[]) {
    const lower = hdrs.map((h) => h.toLowerCase());
    const find = (...keywords: string[]) => {
      const idx = lower.findIndex((h) => keywords.some((k) => h.includes(k)));
      return idx >= 0 ? hdrs[idx] : "";
    };
    return {
      name: find("naam", "name", "product", "artikel", "omschrijving"),
      costPrice: find("aankoop", "inkoop", "kostprijs", "cost", "purchase"),
      salePrice: find("verkoop", "sale", "retail", "prijs klant"),
      quantity: find("aantal", "qty", "quantity", "hoeveelheid"),
      unit: find("eenheid", "unit", "verpakking"),
    };
  }

  function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const hdrs = res.meta.fields || [];
          setHeaders(hdrs);
          setRows(res.data as ParsedRow[]);
          setMapping(guessMapping(hdrs));
        },
        error: () => setError("Kon het CSV-bestand niet lezen."),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as ParsedRow[];
          const hdrs = json.length > 0 ? Object.keys(json[0]) : [];
          setHeaders(hdrs);
          setRows(json);
          setMapping(guessMapping(hdrs));
        } catch {
          setError("Kon het Excel-bestand niet lezen.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError("Enkel .csv, .xlsx of .xls bestanden worden ondersteund.");
    }
  }

  async function handleImport() {
    if (!mapping.name) {
      setError("Kies minstens welke kolom de productnaam bevat.");
      return;
    }
    setImporting(true);
    setError(null);

    const parseNum = (v: string) => {
      if (!v) return undefined;
      const n = parseFloat(String(v).replace(",", "."));
      return isNaN(n) ? undefined : n;
    };

    const importRows = rows
      .map((r) => ({
        name: mapping.name ? r[mapping.name] : "",
        costPrice: mapping.costPrice ? parseNum(r[mapping.costPrice]) : undefined,
        salePrice: mapping.salePrice ? parseNum(r[mapping.salePrice]) : undefined,
        quantity: mapping.quantity ? parseNum(r[mapping.quantity]) : undefined,
        unit: mapping.unit ? r[mapping.unit] : undefined,
      }))
      .filter((r) => r.name && r.name.trim());

    const res = await fetch("/api/products/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: importRows }),
    });

    setImporting(false);
    if (res.ok) {
      const data = await res.json();
      setResult(data);
    } else {
      setError("Er ging iets mis bij het importeren.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-hairline rounded-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
        <h2 className="font-display text-lg mb-1">Leverancier importeren</h2>
        <p className="text-xs text-cream/40 mb-5">
          Laad een Excel- of CSV-bestand van je leverancier in (bv. Kiss of
          Muran). Aantallen in het bestand worden toegevoegd als inkomende
          voorraad.
        </p>

        {result ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gold-gradient flex items-center justify-center text-deep text-xl">
              &check;
            </div>
            <p className="text-sm mb-1">
              {result.created} nieuw product{result.created === 1 ? "" : "en"}{" "}
              toegevoegd
            </p>
            <p className="text-sm text-cream/60 mb-6">
              {result.updated} bestaand product{result.updated === 1 ? "" : "en"}{" "}
              bijgewerkt
            </p>
            <button
              onClick={onDone}
              className="px-6 py-2.5 rounded-full bg-gold-gradient text-deep font-semibold text-sm"
            >
              Sluiten
            </button>
          </div>
        ) : headers.length === 0 ? (
          <div>
            <label className="block border-2 border-dashed border-hairline rounded-xl p-8 text-center cursor-pointer hover:border-gold transition">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <p className="text-sm text-cream/60 mb-1">
                Klik om een bestand te kiezen
              </p>
              <p className="text-xs text-cream/30">.csv, .xlsx of .xls</p>
            </label>
            {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
            <div className="flex gap-2 mt-6">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-full border border-hairline hover:border-gold transition text-sm"
              >
                Annuleren
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs text-cream/40 mb-3">
              {fileName} &middot; {rows.length} rijen gevonden
            </p>

            <div className="space-y-3 mb-4">
              {Object.keys(FIELD_LABELS).map((field) => (
                <div key={field} className="flex items-center gap-3">
                  <label className="w-40 shrink-0 text-xs text-cream/50">
                    {FIELD_LABELS[field]}
                  </label>
                  <select
                    value={mapping[field]}
                    onChange={(e) =>
                      setMapping({ ...mapping, [field]: e.target.value })
                    }
                    className="flex-1 bg-deep border border-hairline rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
                  >
                    <option value="">— geen —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <p className="text-xs text-cream/40 mb-2">Voorbeeld (eerste 3 rijen):</p>
            <div className="overflow-x-auto mb-4 border border-hairline rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-hairline">
                    {headers.map((h) => (
                      <th key={h} className="text-left px-2 py-1.5 text-cream/50 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 3).map((r, i) => (
                    <tr key={i} className="border-b border-hairline/50">
                      {headers.map((h) => (
                        <td key={h} className="px-2 py-1.5 whitespace-nowrap text-cream/70">
                          {r[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-full border border-hairline hover:border-gold transition text-sm"
              >
                Annuleren
              </button>
              <button
                disabled={importing}
                onClick={handleImport}
                className="flex-1 py-2.5 rounded-full bg-gold-gradient text-deep font-semibold text-sm disabled:opacity-40 transition"
              >
                {importing ? "Bezig..." : `${rows.length} rijen importeren`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
