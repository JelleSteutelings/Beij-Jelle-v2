"use client";

export default function BarChart({
  data,
  formatValue,
  height = 140,
}: {
  data: { label: string; value: number }[];
  formatValue?: (v: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div>
      <div
        className="flex items-end gap-1 border-b border-hairline pb-1"
        style={{ height }}
      >
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 min-w-[3px] group relative"
            title={`${d.label}: ${formatValue ? formatValue(d.value) : d.value}`}
          >
            <div
              className="w-full bg-gold-gradient rounded-t transition-all group-hover:brightness-110"
              style={{
                height: `${Math.max(2, (d.value / max) * (height - 4))}px`,
                marginTop: `${height - 4 - Math.max(2, (d.value / max) * (height - 4))}px`,
              }}
            />
          </div>
        ))}
      </div>
      {data.length <= 31 && (
        <div className="flex gap-1 mt-1">
          {data.map((d, i) => (
            <div
              key={i}
              className="flex-1 min-w-[3px] text-center text-[9px] text-cream/30 truncate"
            >
              {data.length <= 12 || i % Math.ceil(data.length / 12) === 0 ? d.label : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
