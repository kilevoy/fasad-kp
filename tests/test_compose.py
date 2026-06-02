"""Тесты сметы: смета поверх результата калькулятора (НДС, скидка, ₽/м²,
доставка, проектирование, монтаж, график оплаты, рендер)."""

from kp.compose import compose_estimate, money
from kp.model import Assumptions, CalcResult, MaterialSection
from kp.render import render_html


def result() -> CalcResult:
    return CalcResult(
        cassette_type="КФ-1",
        cassette_thickness_mm=1.0,
        coating="оцинк. сталь с порошково-полимерным покрытием",
        subsystem_label="П-образная, одноуровневая",
        air_gap_mm=60,
        insulation_mm=150,
        membrane=True,
        facade_count=4,
        gross_area_m2=351.0,
        opening_area_m2=7.9,
        opening_count=4,
        net_area_m2=343.0,
        cassette_area_m2=382.0,
        cassette_pieces=1152,
        materials=[
            MaterialSection("cassettes", "Кассеты", "КФ1", "1152 шт", 703273),
            MaterialSection("subsystem", "Подсистема", "П-образная", "1248", 284915),
            MaterialSection("fasteners", "Крепёж", "крепёж", "компл", 21595),
            MaterialSection("accessories", "Комплектующие", "доборы", "34", 17644),
            MaterialSection("insulation", "Утеплитель", "минвата", "52 м³", 0, by_project=True),
        ],
    )


def test_materials_total_matches_calculator():
    assert result().materials_total == 1027427


def test_vat_and_total_consistent():
    a = Assumptions(discount_pct=5, vat_rate_pct=22, delivery_enabled=False)
    e = compose_estimate(result(), "Екатеринбург", a)
    # без доставки subtotal == материалы калькулятора
    assert e.subtotal == 1027427
    assert abs(e.net - (e.subtotal - e.discount)) < 0.01
    assert abs(e.vat - e.net * 0.22) < 0.5
    assert abs(e.total - (e.net + e.vat)) < 0.01


def test_per_m2_with_vat():
    e = compose_estimate(result(), "Екатеринбург", Assumptions(delivery_enabled=False))
    # 1027427 − 5% + НДС22% ≈ 1190681 / 343 ≈ 3471 ₽/м²
    assert 3000 < e.per_m2 < 4000


def test_by_project_section_excluded_from_sum_and_decomposition():
    e = compose_estimate(result(), "Екатеринбург", Assumptions(delivery_enabled=False))
    assert "Утеплитель" not in e.sections  # sum=0 → не в декомпозиции
    assert e.subtotal == 1027427  # нулевой раздел не влияет


def test_delivery_distance_affects_cost():
    ekb = compose_estimate(result(), "Екатеринбург", Assumptions(delivery_enabled=True))
    chel = compose_estimate(result(), "Челябинск", Assumptions(delivery_enabled=True))
    assert "Доставка" in ekb.sections
    assert ekb.sections["Доставка"] > chel.sections["Доставка"]


def test_design_toggle():
    off = compose_estimate(result(), "Екатеринбург", Assumptions(design_enabled=False))
    on = compose_estimate(result(), "Екатеринбург", Assumptions(design_enabled=True))
    assert "Проектирование" not in off.sections
    assert on.sections["Проектирование"] >= 15000


def test_mounting_adds_section_and_payment_stage():
    off = compose_estimate(result(), "Екатеринбург", Assumptions(mounting_enabled=False))
    on = compose_estimate(result(), "Екатеринбург", Assumptions(mounting_enabled=True))
    assert "Монтаж" not in off.sections
    assert "Монтаж" in on.sections
    assert len(on.payment) == 3
    assert len(off.payment) == 2


def test_payment_sums_to_total():
    e = compose_estimate(result(), "Екатеринбург", Assumptions(mounting_enabled=True))
    assert abs(sum(p.amount for p in e.payment) - e.total) <= 2


def test_money_format():
    assert money(1027427) == "1 027 427 ₽"


def test_render_html_contains_key_blocks():
    html = render_html(result(), "Екатеринбург", number="КП-Т", client="ООО Тест", object_name="Корпус")
    assert "КП-Т" in html
    assert "ООО Тест" in html
    assert "Сводная спецификация" in html
    assert "Почему такая цена" in html
    assert "График оплаты" in html
    assert "703 273 ₽" in html  # сумма раздела «Кассеты» из калькулятора
