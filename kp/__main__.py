"""CLI: результат расчёта фасада (JSON из калькулятора) → HTML коммерческого предложения.

Пример:
    python -m kp sample/calc-result.json --city Екатеринбург --client "ООО Альфа-Строй" --out out/kp.html
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .model import Assumptions, CalcResult, MaterialSection
from .render import render_html


def result_from_dict(d: dict) -> CalcResult:
    materials = [
        MaterialSection(
            key=m.get("key", ""),
            name=m["name"],
            detail=m.get("detail", ""),
            qty=m.get("qty", ""),
            sum=m.get("sum", 0),
            by_project=m.get("byProject", m.get("by_project", False)),
        )
        for m in d.get("materials", [])
    ]
    return CalcResult(
        cassette_type=d["cassetteType"],
        cassette_thickness_mm=d.get("cassetteThicknessMm", 1.0),
        coating=d.get("coating", ""),
        subsystem_label=d.get("subsystemLabel", ""),
        air_gap_mm=d.get("airGapMm", 60),
        insulation_mm=d.get("insulationMm", 150),
        membrane=d.get("membrane", True),
        facade_count=d.get("facadeCount", 1),
        gross_area_m2=d.get("grossAreaM2", 0),
        opening_area_m2=d.get("openingAreaM2", 0),
        opening_count=d.get("openingCount", 0),
        net_area_m2=d["netAreaM2"],
        cassette_area_m2=d.get("cassetteAreaM2", 0),
        cassette_pieces=d.get("cassettePieces", 0),
        materials=materials,
    )


def main() -> None:
    p = argparse.ArgumentParser(description="Генератор КП по фасадной системе ИНСИ")
    p.add_argument("result", help="JSON с результатом расчёта фасада (из калькулятора ИНСИ)")
    p.add_argument("--city", default="Екатеринбург", help="город объекта (для доставки)")
    p.add_argument("--object", default="Объект", help="наименование объекта")
    p.add_argument("--number", default="КП-ФАСАД-001")
    p.add_argument("--date", default="01.06.2026")
    p.add_argument("--client", default="Заказчик")
    p.add_argument("--discount", type=float, default=5)
    p.add_argument("--no-delivery", action="store_true")
    p.add_argument("--design", action="store_true")
    p.add_argument("--mounting", action="store_true")
    p.add_argument("--out", default="out/kp.html")
    args = p.parse_args()

    data = json.loads(Path(args.result).read_text(encoding="utf-8"))
    result = result_from_dict(data)
    a = Assumptions(
        discount_pct=args.discount,
        delivery_enabled=not args.no_delivery,
        design_enabled=args.design,
        mounting_enabled=args.mounting,
    )
    html = render_html(
        result,
        args.city,
        a,
        number=args.number,
        date=args.date,
        client=args.client,
        object_name=args.object,
    )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"КП сохранено: {out}")


if __name__ == "__main__":
    main()
