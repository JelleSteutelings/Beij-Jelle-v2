"use client";

import { useEffect, useState } from "react";
import { Product } from "@/lib/types";
import StockMovementModal from "./StockMovementModal";
import InventoryLedger from "./InventoryLedger";
import ImportModal from "./ImportModal";
import EditProductModal from "./EditProductModal";
import PurchaseOrders from "./PurchaseOrders";
import { useSyncUnsavedChanges } from "../UnsavedChangesContext";

export default function VoorraadPage() {
  const [tab, setTab] = useState<"producten" | "inventaris" | "bestellingen">("producten");
  const [products, setProducts] = useState<Product[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [stock, setStock] = useState(0);
  const [minStock, setMinStock] = useState(1);
  const [unit, setUnit] = useState("stuks");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function load() {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts);
  }

  useEffect(load, []);

  const [newProductError, setNewProductError] = useState<string | null>(null);

  const newProductDraftDirty =
    showNew && (name.trim().length > 0 || costPrice.trim().length > 0 || salePrice.trim().length > 0);
  useSyncUnsavedChanges(newProductDraftDirty);

  async function createProduct() {
    if (!name) return;
    setNewProductError(null);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, stock, minStock, unit, costPrice, salePrice }),
    });
    if (!res.ok) {
      setNewProductError("Aanmaken is mislukt. Je gegevens staan nog klaar — probeer opnieuw.");
      return;
    }
    setName("");
    setStock(0);
    setMinStock(1);
    setUnit("stuks");
    setCostPrice("");
    setSalePrice("");
    setShowNew(false);
    load();
  }

  async function removeProduct(id: string) {
    if (!confirm("Dit product verwijderen?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    load();
  }

  async function persistOrder(reordered: Product[]) {
    setProducts(reordered); // meteen zichtbaar, geen wachttijd
    await fetch("/api/products/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((p) => p.id) }),
    });
  }

  async function moveProduct(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= products.length) return;
    const reordered = [...products];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    persistOrder(reordered);
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...products];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    persistOrder(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  const lowStock = products.filter((p) => p.stock <= p.minStock);
  const [productSearch, setProductSearch] = useState("");
  const filteredProducts = productSearch.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(productSearch.trim().toLowerCase()))
    : products;

  return (
    <div className="p-6 sm:p-10 max-w-2xl">
      <h1 className="font-display text-2xl mb-6">Voorraad</h1>

      <div className="flex items-center gap-1.5 mb-6">
        {(["producten", "bestellingen", "inventaris"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-3.5 py-1.5 rounded-full border transition ${
              tab === t
                ? "bg-gold-gradient text-deep font-semibold border-transparent"
                : "border-hairline text-cream/60 hover:border-gold"
            }`}
          >
            {t === "producten" ? "Producten" : t === "bestellingen" ? "Bestellingen" : "Inventaris"}
          </button>
        ))}
      </div>

      {tab === "inventaris" ? (
        <InventoryLedger />
      ) : tab === "bestellingen" ? (
        <PurchaseOrders products={products} />
      ) : (
        <>
          <div className="flex items-center justify-between mb-1">
            <p className="text-cream/40 text-sm">
              {products.length} producten
              {lowStock.length > 0 && (
                <span className="text-amber-400"> · {lowStock.length} bijna op</span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowImport(true)}
                className="text-xs border border-hairline hover:border-gold rounded-full px-4 py-2 transition"
              >
                Leverancier importeren
              </button>
              <button
                onClick={() => setShowNew((v) => !v)}
                className="text-xs border border-hairline hover:border-gold rounded-full px-4 py-2 transition"
              >
                + Product toevoegen
              </button>
            </div>
          </div>

          {showNew && (
            <div className="my-4 p-4 border border-hairline rounded-xl bg-panel/40 grid sm:grid-cols-4 gap-2 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs text-cream/50 mb-1">Naam</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-xs text-cream/50 mb-1">Voorraad</label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                  className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-xs text-cream/50 mb-1">Minimum</label>
                <input
                  type="number"
                  value={minStock}
                  onChange={(e) => setMinStock(Number(e.target.value))}
                  className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-xs text-cream/50 mb-1">Eenheid</label>
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="stuks, flessen, ml..."
                  className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-xs text-cream/50 mb-1">Aankoopprijs</label>
                <input
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="€"
                  className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-xs text-cream/50 mb-1">Verkoopprijs</label>
                <input
                  type="number"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="€"
                  className="w-full bg-deep border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <button
                onClick={createProduct}
                className="text-xs px-4 py-2 rounded-full bg-gold-gradient text-deep font-semibold h-fit"
              >
                Opslaan
              </button>
              {newProductError && (
                <p className="text-red-400 text-xs sm:col-span-4">{newProductError}</p>
              )}
              {newProductDraftDirty && !newProductError && (
                <p className="text-[11px] text-amber-300/90 sm:col-span-4">
                  ⚠ Niet-opgeslagen product — gaat verloren als je wegnavigeert zonder op &ldquo;Opslaan&rdquo; te klikken.
                </p>
              )}
            </div>
          )}

          <div className="relative mb-3">
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Zoek een product op naam..."
              className="w-full bg-panel border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
            {productSearch && (
              <button
                onClick={() => setProductSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-cream/30 hover:text-gold text-sm px-1"
                title="Zoekveld wissen"
              >
                &times;
              </button>
            )}
          </div>

          <p className="text-[11px] text-cream/30 -mt-1 mb-2">
            Versleep het handvat (⠿) om te herordenen, of gebruik de pijltjes.
          </p>
          <ul className="space-y-2">
            {filteredProducts.map((p) => {
              const index = products.findIndex((x) => x.id === p.id);
              const low = p.stock <= p.minStock;
              return (
                <li
                  key={p.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverIndex !== index) setDragOverIndex(index);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(index);
                  }}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition ${
                    low ? "border-amber-700/50 bg-amber-950/20" : "border-hairline bg-panel/30"
                  } ${dragIndex === index ? "opacity-40" : ""} ${
                    dragOverIndex === index && dragIndex !== index
                      ? "border-gold border-t-2"
                      : ""
                  }`}
                >
                  <span
                    className="text-cream/25 hover:text-gold cursor-grab active:cursor-grabbing shrink-0 select-none text-lg leading-none px-1"
                    title="Versleep om te herordenen"
                  >
                    ⠿
                  </span>
                  <div className="flex flex-col shrink-0 -my-1">
                    <button
                      onClick={() => moveProduct(index, -1)}
                      disabled={index === 0}
                      className="text-cream/30 hover:text-gold disabled:opacity-20 disabled:hover:text-cream/30 leading-none px-1"
                      aria-label="Naar boven"
                      title="Naar boven verplaatsen"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveProduct(index, 1)}
                      disabled={index === products.length - 1}
                      className="text-cream/30 hover:text-gold disabled:opacity-20 disabled:hover:text-cream/30 leading-none px-1"
                      aria-label="Naar onder"
                      title="Naar onder verplaatsen"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{p.name}</p>
                    <p className={`text-xs ${low ? "text-amber-400" : "text-cream/40"}`}>
                      {p.stock} {p.unit} {low && "· bijna op"}
                      {(p.costPrice !== undefined || p.salePrice !== undefined) && (
                        <span className="text-cream/65">
                          {" · "}
                          {p.costPrice !== undefined && `inkoop €${p.costPrice}`}
                          {p.costPrice !== undefined && p.salePrice !== undefined && " / "}
                          {p.salePrice !== undefined && `verkoop €${p.salePrice}`}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setMovementProduct(p)}
                      className="text-xs px-3 py-1.5 rounded-full bg-gold-gradient text-deep font-semibold"
                    >
                      Beweging
                    </button>
                    <button
                      onClick={() => setEditProduct(p)}
                      className="text-xs px-3 py-1.5 rounded-full border border-hairline hover:border-gold transition"
                    >
                      Bewerken
                    </button>
                    <button
                      onClick={() => removeProduct(p.id)}
                      className="text-xs text-cream/30 hover:text-red-400 px-2"
                    >
                      verwijderen
                    </button>
                  </div>
                </li>
              );
            })}
            {products.length === 0 && (
              <p className="text-cream/40 text-sm">Nog geen producten toegevoegd.</p>
            )}
            {products.length > 0 && filteredProducts.length === 0 && (
              <p className="text-cream/40 text-sm">
                Geen producten gevonden voor &ldquo;{productSearch}&rdquo;.
              </p>
            )}
          </ul>
        </>
      )}

      {movementProduct && (
        <StockMovementModal
          product={movementProduct}
          onClose={() => setMovementProduct(null)}
          onDone={() => {
            setMovementProduct(null);
            load();
          }}
        />
      )}

      {editProduct && (
        <EditProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onDone={() => {
            setEditProduct(null);
            load();
          }}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            load();
          }}
        />
      )}
    </div>
  );
}
