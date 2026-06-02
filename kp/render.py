"""Рендер КП в самодостаточную HTML-страницу (готова к печати в PDF)."""

from __future__ import annotations

from . import compose
from .compose import money
from .model import Assumptions, CalcResult


def render_html(
    result: CalcResult,
    city: str,
    a: Assumptions | None = None,
    *,
    number: str = "КП-ФАСАД-001",
    date: str = "01.06.2026",
    client: str = "Заказчик",
    object_name: str = "Объект",
) -> str:
    a = a or Assumptions()
    est = compose.compose_estimate(result, city, a)

    spec = "".join(
        f"<tr><td>{l.section}</td><td>{l.name}</td><td class=r>{l.qty}</td>"
        f"<td class=r>{'по проекту' if l.by_project else money(l.sum)}</td></tr>"
        for l in est.lines
    )

    max_sum = max(est.sections.values(), default=1)
    bars = "".join(
        f'<div class="bar"><div class="bh"><span>{name}</span><b>{money(val)}</b></div>'
        f"<div class='bt'><div class='bf' style='width:{max(4, val / max_sum * 100):.0f}%'></div></div></div>"
        for name, val in est.sections.items()
    )

    pay = "".join(
        f"<div class='pay'><span>{p.name}<br><small>{p.when}</small></span><b>{money(p.amount)}</b></div>"
        for p in est.payment
    )

    return f"""<!doctype html><html lang="ru"><head><meta charset="utf-8">
<title>{number} · {object_name}</title>
<style>
 body{{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1f2b;margin:0;background:#f4f6fa}}
 .kp{{max-width:840px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(16,24,40,.12)}}
 .cover{{padding:34px 36px;background:linear-gradient(135deg,#1b2b4a,#2f5fd0);color:#fff}}
 .offer{{font-size:18px;font-weight:700;margin-top:10px;line-height:1.4}}
 .metrics{{display:flex;gap:12px;margin-top:20px}}
 .metrics div{{background:rgba(255,255,255,.12);border-radius:12px;padding:12px 14px;flex:1}}
 .metrics b{{display:block;font-size:20px}} .metrics span{{font-size:12px;opacity:.85}}
 .sec{{padding:24px 36px;border-top:1px solid #e4e8f0}}
 h3{{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#2f5fd0;margin:0 0 14px}}
 table{{width:100%;border-collapse:collapse;font-size:13px}}
 th{{text-align:left;color:#6b7480;font-size:11px;text-transform:uppercase;padding:8px;border-bottom:2px solid #e4e8f0}}
 td{{padding:9px 8px;border-bottom:1px solid #eef1f6;vertical-align:top}} .r{{text-align:right;white-space:nowrap}}
 .tot{{width:340px;margin-left:auto;font-size:14px;margin-top:14px}} .tot div{{display:flex;justify-content:space-between;padding:5px 0}}
 .grand{{border-top:2px solid #e4e8f0;margin-top:6px;padding-top:10px;font-size:19px;font-weight:800;color:#2f5fd0}}
 .bar{{margin-bottom:11px}} .bh{{display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px}}
 .bt{{height:10px;background:#eef1f6;border-radius:999px;overflow:hidden}}
 .bf{{height:100%;background:linear-gradient(90deg,#2f5fd0,#6d4ee0)}}
 .pay{{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eef1f6}}
 small{{color:#6b7480}}
 @media print{{body{{background:#fff}}.kp{{box-shadow:none;margin:0}}}}
</style></head><body><div class="kp">
<div class="cover"><div style="font-size:12px;opacity:.85">{number} · {date}</div>
<div style="font-size:15px;margin-top:8px">Коммерческое предложение · навесная фасадная система</div>
<div class="offer">{result.cassette_type} {result.cassette_thickness_mm:.1f} мм · {result.coating} · {result.subsystem_label}</div>
<div style="margin-top:14px;font-size:14px">Для: <b>{client}</b> · Объект: {object_name}, {city}</div>
<div class="metrics"><div><b>{money(est.total)}</b><span>итого с НДС {a.vat_rate_pct:.0f}%</span></div>
<div><b>{money(est.per_m2)}</b><span>₽/м²</span></div>
<div><b>{result.net_area_m2:.2f} м²</b><span>чистая площадь · {result.facade_count} фасада</span></div></div></div>
<div class="sec"><h3>Сводная спецификация</h3><table>
<tr><th>Раздел</th><th>Позиция</th><th class=r>Кол-во</th><th class=r>Сумма</th></tr>{spec}</table>
<div class="tot"><div><span>Материалы и работы</span><span>{money(est.subtotal)}</span></div>
<div><span>Скидка {a.discount_pct:.0f}%</span><span>−{money(est.discount)}</span></div>
<div><span>Итого без НДС</span><span>{money(est.net)}</span></div>
<div><span>НДС {a.vat_rate_pct:.0f}%</span><span>{money(est.vat)}</span></div>
<div class="grand"><span>Итого с НДС</span><span>{money(est.total)}</span></div></div></div>
<div class="sec"><h3>Почему такая цена</h3>{bars}</div>
<div class="sec"><h3>График оплаты</h3>{pay}</div>
</div></body></html>"""
