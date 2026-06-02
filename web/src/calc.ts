// Расчётное ядро КП.
// ВХОД — готовый результат расчёта из калькулятора ИНСИ (fasad): сводная
// спецификация (разделы и суммы) и итоговые показатели. КП НЕ пересчитывает
// материалы заново — оно берёт результат калькулятора и накладывает сверху
// коммерческие слои (скидка, НДС, доставка, проектирование, монтаж).

export interface MaterialSection {
  key: string
  name: string
  detail: string // что входит в раздел
  qty: string // натуральное количество
  sum: number // ₽ без НДС (0 — «по проекту»)
  byProject?: boolean // цена уточняется проектом
}

export interface CalcResult {
  // параметры системы (из калькулятора)
  cassetteType: string
  cassetteThicknessMm: number
  coating: string
  subsystemLabel: string
  airGapMm: number
  insulationMm: number
  membrane: boolean
  // геометрия
  facadeCount: number
  grossAreaM2: number
  openingAreaM2: number
  openingCount: number
  netAreaM2: number
  // кассеты
  cassetteAreaM2: number
  cassettePieces: number
  // спецификация
  materials: MaterialSection[]
  materialsTotal: number
}

export interface CommercialAssumptions {
  mountingEnabled: boolean
  mountingPerM2: number
  deliveryEnabled: boolean // доставка Челябинск → город объекта
  designEnabled: boolean // проектирование / монтажная схема
  discountPct: number
  vatRatePct: number
}

export const defaultAssumptions: CommercialAssumptions = {
  mountingEnabled: false,
  mountingPerM2: 1850,
  deliveryEnabled: true,
  designEnabled: false,
  discountPct: 5,
  vatRatePct: 22,
}

// Доставка: отгрузка с производства в Челябинске.
export const DELIVERY_ORIGIN = 'Челябинск'
const DELIVERY_BASE = 6000
const DELIVERY_PER_KM = 60
const DESIGN_PER_M2 = 120
const DESIGN_MIN = 15000
// Расстояние от Челябинска, км. Неизвестный город — оценка по умолчанию.
const DISTANCES_KM: Record<string, number> = {
  Челябинск: 0,
  Екатеринбург: 210,
  Курган: 260,
  Магнитогорск: 310,
  Тюмень: 410,
  Уфа: 420,
  Пермь: 570,
  Казань: 870,
  Самара: 870,
  Москва: 1770,
}
export function deliveryDistanceKm(city: string): number {
  return DISTANCES_KM[city.trim()] ?? 500
}
export function deliveryCost(city: string): number {
  const km = deliveryDistanceKm(city)
  return km === 0 ? DELIVERY_BASE : DELIVERY_BASE + km * DELIVERY_PER_KM
}

export interface SectionSum {
  name: string
  sum: number
}

export interface BomLine {
  section: string
  name: string
  qty: string
  unitPrice: string
  sum: number
  byProject?: boolean
}

export interface Estimate {
  sections: SectionSum[]
  lines: BomLine[]
  subtotal: number
  discount: number
  net: number
  vat: number
  total: number
  perM2: number
}

const r2 = (v: number) => Math.round(v * 100) / 100

export function buildEstimate(
  result: CalcResult,
  city: string,
  a: CommercialAssumptions = defaultAssumptions,
): Estimate {
  const net = result.netAreaM2

  const lines: BomLine[] = result.materials.map((m) => ({
    section: m.name,
    name: m.detail,
    qty: m.qty,
    unitPrice: m.byProject ? 'по проекту' : 'по прайсу',
    sum: m.sum,
    byProject: m.byProject,
  }))

  // Коммерческие слои поверх материалов калькулятора
  const designSum = a.designEnabled ? Math.max(DESIGN_MIN, net * DESIGN_PER_M2) : 0
  const deliverySum = a.deliveryEnabled ? deliveryCost(city) : 0
  const mountingSum = a.mountingEnabled ? net * a.mountingPerM2 : 0

  if (designSum > 0)
    lines.push({
      section: 'Проектирование',
      name: 'Проектирование / монтажная схема НВФ',
      qty: `${fmtArea(net)} м²`,
      unitPrice: 'расчётно',
      sum: designSum,
    })
  if (deliverySum > 0)
    lines.push({
      section: 'Доставка',
      name: `Доставка ${DELIVERY_ORIGIN} → ${city} (${fmtNum(deliveryDistanceKm(city))} км)`,
      qty: '1 рейс',
      unitPrice: 'расчётно',
      sum: deliverySum,
    })
  if (mountingSum > 0)
    lines.push({
      section: 'Монтаж',
      name: 'Монтаж НВФ по готовому основанию',
      qty: `${fmtArea(net)} м²`,
      unitPrice: `${fmtNum(a.mountingPerM2)} ₽/м²`,
      sum: mountingSum,
    })

  const subtotal = result.materialsTotal + designSum + deliverySum + mountingSum
  const discount = r2(subtotal * (a.discountPct / 100))
  const netSum = subtotal - discount
  const vat = r2(netSum * (a.vatRatePct / 100))
  const total = netSum + vat

  const sections: SectionSum[] = [
    ...result.materials.filter((m) => m.sum > 0).map((m) => ({ name: m.name, sum: m.sum })),
    { name: 'Проектирование', sum: designSum },
    { name: 'Доставка', sum: deliverySum },
    { name: 'Монтаж', sum: mountingSum },
  ].filter((s) => s.sum > 0)

  return {
    sections,
    lines,
    subtotal,
    discount,
    net: netSum,
    vat,
    total,
    perM2: net > 0 ? total / net : 0,
  }
}

// --- Форматтеры ---
export const fmtNum = (v: number) => Math.round(v).toLocaleString('ru-RU')
export const money = (v: number) => Math.round(v).toLocaleString('ru-RU') + ' ₽'
export const fmtArea = (v: number) =>
  v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
