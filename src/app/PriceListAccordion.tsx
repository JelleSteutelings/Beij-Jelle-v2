"use client";

import { useState } from "react";
import { Service } from "@/lib/types";

export default function PriceListAccordion({
  grouped,
}: {
  grouped: Record<string, Service[]>;
}) {
  const categories = Object.keys(grouped);
  const [open, setOpen] = useState<string | null>(categories[0] || null);

  return (
    <div className="border-t border-hairline">
      {categories.map((category) => {
        const isOpen = open === category;
        return (
          <div key={category} className="border-b border-hairline">
            <button
              onClick={() => setOpen(isOpen ? null : category)}
              className="w-full flex items-center justify-between py-4 text-left group"
            >
              <span
                className={`font-display text-lg transition-colors ${
                  isOpen ? "text-gold" : "text-cream/85 group-hover:text-gold-light"
                }`}
              >
                {category}
              </span>
              <span
                className={`text-gold transition-transform duration-200 ${
                  isOpen ? "rotate-90" : ""
                }`}
              >
                &rsaquo;
              </span>
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ${
                isOpen ? "max-h-[1000px] opacity-100 pb-5" : "max-h-0 opacity-0"
              }`}
            >
              <ul className="space-y-2.5">
                {grouped[category].map((s) => (
                  <li key={s.id} className="flex items-baseline gap-2">
                    <span className="text-cream/90">{s.name}</span>
                    <span className="flex-1 border-b border-dotted border-hairline translate-y-[-3px]" />
                    <span className="font-display text-gold-light">
                      &euro;{s.price}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
