export type ServiceBlock = {
  durationMinutes: number;
  busy: boolean; // true = Jelle is bezig, false = vrij/wachttijd (bv. inwerktijd bij kleuring)
  color?: string; // eigen kleur voor dit blok (enkel blok 2+, blok 1 volgt altijd de hoofdkleur van de dienst)
};

export type Service = {
  id: string;
  category: string;
  name: string;
  price: number; // euros
  durationMinutes: number; // totale duur (= som van blocks, indien ingesteld)
  active: boolean;
  color?: string; // hex-kleur, gebruikt in de agenda voor deze dienst
  blocks?: ServiceBlock[]; // optioneel, max 5. Zonder blocks: 1 bezet blok van durationMinutes.
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  reminderLongHoursOverride?: number; // wijkt af van de standaard (settings), indien ingevuld
  reminderShortHoursOverride?: number;
  createdAt: string;
};

export type BookingStatus = "confirmed" | "pending" | "done" | "cancelled" | "blocked" | "no_show";

export type BookingBlock = {
  offsetMinutes: number; // vanaf booking.start
  durationMinutes: number;
  busy: boolean;
};

export type Booking = {
  id: string;
  serviceId: string | null; // null when it's a manual "blocked" slot
  customerId: string | null;
  customerName?: string; // snapshot, in case customer record changes
  start: string; // ISO datetime
  end: string; // ISO datetime
  status: BookingStatus;
  notes?: string;
  blocks?: BookingBlock[]; // snapshot van de dienst-blokken op moment van boeken
  remindedLongAt?: string;
  remindedShortAt?: string;
  createdAt: string;
};

export type Product = {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  unit: string; // e.g. "stuks", "ml", "flessen"
  costPrice?: number; // aankoopprijs per eenheid
  salePrice?: number; // standaard verkoopprijs aan klant per eenheid
  order?: number; // zelf gekozen volgorde in de lijst
};

export type StockMovementType = "in" | "sold" | "used";

export type PurchaseOrderStatus = "besteld" | "ontvangen" | "geannuleerd";

export type PurchaseOrderItem = {
  productId?: string; // gekoppeld bestaand product, indien van toepassing
  productName: string; // vrije naam (ook voor een nog niet bestaand product)
  quantity: number;
  unitCost?: number; // verwachte aankoopprijs per eenheid
};

/** Een bestelling die klaargezet wordt bij een leverancier. Blijft op
 * "besteld" staan tot ze wordt afgerond (dan pas komt ze in de stock en de
 * kosten terecht) of geannuleerd (bv. verkeerd besteld, nooit geleverd) —
 * een annulering blijft zichtbaar in de lijst, dit is geen manier om een
 * effectief ontvangen levering nadien te laten verdwijnen. */
export type PurchaseOrder = {
  id: string;
  supplier?: string;
  items: PurchaseOrderItem[];
  status: PurchaseOrderStatus;
  notes?: string;
  createdAt: string;
  receivedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
};

export type StockMovement = {
  id: string;
  productId: string;
  productName: string; // snapshot, in case product is later renamed/removed
  type: StockMovementType; // "in" = inkomend/aankoop, "sold" = verkocht aan klant, "used" = verbruikt tijdens behandeling
  quantity: number; // altijd positief; het effect op de voorraad hangt af van "type"
  unitCost?: number; // aankoopprijs per eenheid, voor type "in"
  unitPrice?: number; // verkoopprijs per eenheid, voor type "sold"
  note?: string;
  saleId?: string; // gekoppeld aan een kassaverkoop, indien van toepassing
  createdAt: string;
};

export type SaleItem = {
  type: "service" | "product";
  refId: string;
  name: string;
  price: number;
  qty: number;
};

export type CancellationRecord = {
  id: string;
  customerId?: string;
  customerName: string;
  serviceName: string;
  date: string; // ISO datetime van de geannuleerde afspraak
  reason?: string;
  bookingId?: string; // referentie, indien de afspraak nog bestaat
  createdAt: string;
};

export type NoShowRecord = {
  id: string;
  customerId: string;
  customerName: string;
  serviceName: string;
  date: string; // ISO datetime van de gemiste afspraak
  bookingId?: string; // referentie, indien de afspraak nog bestaat
  createdAt: string;
};

/** Intern controlespoor wanneer een afgeronde kassaverrichting volledig
 * ongedaan gemaakt wordt (verkoop + afspraak verdwijnen uit de agenda en
 * de dagontvangsten). Enkel zichtbaar voor de beheerder zelf — nergens
 * getoond aan klanten en geen deel van export/rapportages — maar bewust
 * niet spoorloos: zo blijft er altijd een intern overzicht van wie wat
 * corrigeerde en waarom. */
export type CorrectionRecord = {
  id: string;
  saleId: string;
  bookingId?: string;
  customerId?: string;
  customerName?: string;
  serviceName?: string;
  originalTotal: number;
  paymentMethod: SalePaymentMethod;
  reason: string;
  correctedAt: string;
};

export type GiftVoucher = {
  id: string;
  code: string; // referentiecode die Jelle zelf op de fysieke bon schrijft
  originalAmount: number;
  remainingAmount: number;
  origin: "paid" | "sponsoring"; // betaald door klant, of gratis weggegeven (sponsoring)
  customerId?: string; // wie de bon kocht of ontving, indien gekend
  customerName?: string; // snapshot
  note?: string;
  issuedAt: string; // wanneer de bon uitgeschreven werd (buiten de app)
  createdAt: string;
};

export type SalePaymentMethod = "cash" | "qr" | "voucher";

export type Sale = {
  id: string;
  bookingId?: string;
  customerId?: string;
  customerName?: string; // snapshot, ook beschikbaar zonder gekoppeld klantprofiel
  items: SaleItem[];
  total: number;
  paymentMethod: SalePaymentMethod;
  giftVoucherId?: string;
  giftVoucherCode?: string;
  giftVoucherAmountUsed?: number;
  studentDiscount?: boolean;
  createdAt: string;
};

export type DayHours = { start: string; end: string }[]; // empty array = closed

export type OpeningHours = {
  mon: DayHours;
  tue: DayHours;
  wed: DayHours;
  thu: DayHours;
  fri: DayHours;
  sat: DayHours;
  sun: DayHours;
};

export type Settings = {
  businessName: string;
  ownerName: string;
  address: string;
  postalCity: string;
  phone: string;
  vatNumber?: string;
  bankAccountNumber?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  openingHours: OpeningHours;
  reminderLongHours: number; // bv. 24 = een dag op voorhand
  reminderShortHours: number; // bv. 2 = twee uur op voorhand
  qrImageDataUrl?: string; // Payconiq/Bancontact QR, uploaded by the owner
  adminPasswordHash: string;
  slotStepMinutes: number; // granularity for booking slots
  studentDiscountPercent: number; // bv. 10 = 10% korting
};

export type DB = {
  services: Service[];
  customers: Customer[];
  bookings: Booking[];
  products: Product[];
  stockMovements: StockMovement[];
  purchaseOrders: PurchaseOrder[];
  giftVouchers: GiftVoucher[];
  noShowRecords: NoShowRecord[];
  cancellationRecords: CancellationRecord[];
  correctionRecords: CorrectionRecord[];
  sales: Sale[];
  settings: Settings;
};
