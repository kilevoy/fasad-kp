"""Модель данных.

ВХОД генератора КП — готовый результат расчёта из калькулятора ИНСИ (fasad):
сводная спецификация (разделы и суммы) и итоговые показатели. КП не пересчитывает
материалы — оно берёт результат калькулятора и накладывает коммерческие слои.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class MaterialSection:
    key: str
    name: str
    detail: str
    qty: str
    sum: float  # ₽ без НДС (0 — «по проекту»)
    by_project: bool = False


@dataclass
class CalcResult:
    cassette_type: str
    cassette_thickness_mm: float
    coating: str
    subsystem_label: str
    air_gap_mm: float
    insulation_mm: float
    membrane: bool
    facade_count: int
    gross_area_m2: float
    opening_area_m2: float
    opening_count: int
    net_area_m2: float
    cassette_area_m2: float
    cassette_pieces: int
    materials: list[MaterialSection] = field(default_factory=list)

    @property
    def materials_total(self) -> float:
        return sum(m.sum for m in self.materials)


@dataclass
class Assumptions:
    """Коммерческие допущения — единственное, что меняет менеджер."""

    mounting_enabled: bool = False
    mounting_per_m2: float = 1850
    delivery_enabled: bool = True  # доставка Челябинск → город объекта
    design_enabled: bool = False  # проектирование / монтажная схема
    discount_pct: float = 5
    vat_rate_pct: float = 22


# Доставка: отгрузка с производства в Челябинске.
DELIVERY_ORIGIN = "Челябинск"
DELIVERY_BASE = 6000.0
DELIVERY_PER_KM = 60.0
DESIGN_PER_M2 = 120.0
DESIGN_MIN = 15000.0
DISTANCES_KM: dict[str, float] = {
    "Челябинск": 0,
    "Екатеринбург": 210,
    "Курган": 260,
    "Магнитогорск": 310,
    "Тюмень": 410,
    "Уфа": 420,
    "Пермь": 570,
    "Казань": 870,
    "Самара": 870,
    "Москва": 1770,
}


def delivery_distance_km(city: str) -> float:
    return DISTANCES_KM.get(city.strip(), 500)


def delivery_cost(city: str) -> float:
    km = delivery_distance_km(city)
    return DELIVERY_BASE if km == 0 else DELIVERY_BASE + km * DELIVERY_PER_KM
