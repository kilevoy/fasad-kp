"""Коммерческая смета поверх результата калькулятора: разделы, скидка, НДС,
₽/м², график оплаты."""

from __future__ import annotations

from dataclasses import dataclass, field

from . import model
from .model import Assumptions, CalcResult


@dataclass
class Line:
    section: str
    name: str
    qty: str
    unit_price: str
    sum: float
    by_project: bool = False


@dataclass
class PaymentStage:
    name: str
    amount: float
    when: str


@dataclass
class Estimate:
    sections: dict[str, float]  # для декомпозиции цены
    lines: list[Line] = field(default_factory=list)
    subtotal: float = 0
    discount: float = 0
    net: float = 0
    vat: float = 0
    total: float = 0
    per_m2: float = 0
    payment: list[PaymentStage] = field(default_factory=list)


def _r2(v: float) -> float:
    return round(v * 100) / 100


def compose_estimate(result: CalcResult, city: str, a: Assumptions | None = None) -> Estimate:
    a = a or Assumptions()
    net_area = result.net_area_m2

    lines = [
        Line(
            m.name,
            m.detail,
            m.qty,
            "по проекту" if m.by_project else "по прайсу",
            m.sum,
            m.by_project,
        )
        for m in result.materials
    ]

    design_sum = max(model.DESIGN_MIN, net_area * model.DESIGN_PER_M2) if a.design_enabled else 0.0
    delivery_sum = model.delivery_cost(city) if a.delivery_enabled else 0.0
    mounting_sum = net_area * a.mounting_per_m2 if a.mounting_enabled else 0.0

    if design_sum > 0:
        lines.append(
            Line("Проектирование", "Проектирование / монтажная схема НВФ", f"{net_area:.2f} м²", "расчётно", design_sum)
        )
    if delivery_sum > 0:
        km = model.delivery_distance_km(city)
        lines.append(
            Line("Доставка", f"Доставка {model.DELIVERY_ORIGIN} → {city} ({km:.0f} км)", "1 рейс", "расчётно", delivery_sum)
        )
    if mounting_sum > 0:
        lines.append(
            Line("Монтаж", "Монтаж НВФ по готовому основанию", f"{net_area:.2f} м²", f"{a.mounting_per_m2:.0f} ₽/м²", mounting_sum)
        )

    subtotal = result.materials_total + design_sum + delivery_sum + mounting_sum
    discount = _r2(subtotal * a.discount_pct / 100)
    net = subtotal - discount
    vat = _r2(net * a.vat_rate_pct / 100)
    total = net + vat
    per_m2 = total / net_area if net_area else 0.0

    sections: dict[str, float] = {m.name: m.sum for m in result.materials if m.sum > 0}
    if design_sum > 0:
        sections["Проектирование"] = design_sum
    if delivery_sum > 0:
        sections["Доставка"] = delivery_sum
    if mounting_sum > 0:
        sections["Монтаж"] = mounting_sum

    # График оплаты: материалы (аванс 50% + по уведомлению), монтаж — после актов.
    mounting_gross = total * (mounting_sum / subtotal) if subtotal else 0.0
    materials_gross = total - mounting_gross
    advance = round(materials_gross * 0.5)
    on_notice = round(materials_gross - advance)
    payment = [
        PaymentStage("Аванс на закупку (50% материалов)", advance, "при подписании договора"),
        PaymentStage(
            "Оплата по уведомлению о готовности к отгрузке",
            on_notice,
            "по уведомлению о готовности товара к отгрузке",
        ),
    ]
    if mounting_gross > 0:
        payment.append(PaymentStage("Монтаж", round(mounting_gross), "после подписания актов"))

    return Estimate(
        sections=sections,
        lines=lines,
        subtotal=subtotal,
        discount=discount,
        net=net,
        vat=vat,
        total=total,
        per_m2=per_m2,
        payment=payment,
    )


def money(v: float) -> str:
    return f"{round(v):,}".replace(",", " ") + " ₽"
