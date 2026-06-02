import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildEstimate,
  defaultAssumptions,
  deliveryDistanceKm,
  DELIVERY_ORIGIN,
  fmtArea,
  fmtNum,
  money,
  type CommercialAssumptions,
} from './calc'
import { calcResult, meta, objectCity, objectName, stages } from './data'

type Phase = 'idle' | 'running' | 'done'

function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
  )
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])
  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label="Переключить тему"
      title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}

export default function App() {
  return (
    <div className="page">
      <a className="backlink" href="https://kilevoy.github.io/" title="Вернуться в портфолио">
        ← Портфолио
      </a>
      <ThemeToggle />
      <Hero />
      <Demo />
      <HowItWorks />
      <Footer />
    </div>
  )
}

function Hero() {
  const toDemo = () => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
  return (
    <header className="hero">
      <div className="badge">Фасады · НВФ ИНСИ · CPQ</div>
      <h1>
        КП по фасаду <span className="grad">из расчёта</span>
      </h1>
      <p className="lead">
        На входе — результат расчёта фасадной системы (геометрия и спецификация). На выходе —
        готовое коммерческое предложение: <b>смета из реального прайса ИНСИ</b>, декомпозиция цены,
        ₽/м², условия и PDF. Часы в Excel → секунды.
      </p>
      <div className="hero-cta">
        <button className="btn primary" onClick={toDemo}>
          ▶ Собрать КП по расчёту
        </button>
        <a
          className="btn ghost"
          href="https://github.com/kilevoy/fasad-kp"
          target="_blank"
          rel="noreferrer"
        >
          Исходный код
        </a>
      </div>
      <div className="flow">
        <span>📐 Геометрия</span>
        <i>→</i>
        <span>🧱 Спецификация</span>
        <i>→</i>
        <span>🧮 Смета</span>
        <i>→</i>
        <span>📄 КП + PDF</span>
      </div>
    </header>
  )
}

function Demo() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [active, setActive] = useState(-1)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const run = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setPhase('running')
    setActive(0)
    const step = 850
    stages.forEach((_, i) =>
      timers.current.push(window.setTimeout(() => setActive(i), step * i)),
    )
    timers.current.push(
      window.setTimeout(() => {
        setActive(stages.length)
        setPhase('done')
      }, step * stages.length),
    )
  }
  const reset = () => {
    timers.current.forEach(clearTimeout)
    setPhase('idle')
    setActive(-1)
  }

  return (
    <section id="demo" className="demo">
      <h2>Демонстрация</h2>
      <p className="section-sub">
        Пример: {meta.client}, объект «{objectName}», {objectCity}. Расчёт фасада уже выполнен —
        собираем по нему КП.
      </p>
      <div className="demo-controls">
        {phase === 'idle' && (
          <button className="btn primary" onClick={run}>
            ▶ Собрать КП по расчёту
          </button>
        )}
        {phase === 'running' && (
          <button className="btn" disabled>
            ⏳ Сборка…
          </button>
        )}
        {phase === 'done' && (
          <button className="btn ghost" onClick={reset}>
            ↺ Заново
          </button>
        )}
      </div>
      <div className="pipeline">
        {stages.map((s, i) => {
          const state = active > i ? 'done' : active === i ? 'active' : 'wait'
          return (
            <div key={s.id} className={`stage ${state}`}>
              <div className="stage-icon">{s.icon}</div>
              <div className="stage-body">
                <div className="stage-title">{s.title}</div>
                <div className="stage-tech">{s.tech}</div>
                <div className="stage-desc">{s.desc}</div>
              </div>
              <div className="stage-status">
                {state === 'done' ? '✓' : state === 'active' ? '…' : ''}
              </div>
            </div>
          )
        })}
      </div>
      {phase === 'done' && <ProposalView />}
    </section>
  )
}

function ProposalView() {
  const [a, setA] = useState<CommercialAssumptions>(defaultAssumptions)
  const est = useMemo(() => buildEstimate(calcResult, objectCity, a), [a])
  const set = (patch: Partial<CommercialAssumptions>) => setA((prev) => ({ ...prev, ...patch }))
  const maxSection = Math.max(...est.sections.map((s) => s.sum), 1)

  // график оплаты: материалы (аванс 50% + по поставке) + монтаж после актов
  const mountingGross = a.mountingEnabled ? est.total * (sectionShare(est, 'Монтаж')) : 0
  const materialsGross = est.total - mountingGross
  const advance = Math.round(materialsGross * 0.5)
  const delivery = Math.round(materialsGross - advance)
  const payment = [
    { name: 'Аванс на закупку (50% материалов)', amount: advance, when: 'при подписании договора' },
    {
      name: 'Оплата по уведомлению о готовности к отгрузке',
      amount: delivery,
      when: 'по уведомлению о готовности товара к отгрузке',
    },
  ]
  if (mountingGross > 0)
    payment.push({
      name: 'Монтаж',
      amount: Math.round(mountingGross),
      when: 'после подписания актов',
    })

  return (
    <div className="result show">
      <div className="result-bar">
        <span className="viewed">Коммерческое предложение готово</span>
        <button className="btn primary sm" onClick={() => window.print()}>
          ↓ Сохранить / печать PDF
        </button>
      </div>

      <div className="kp">
        <div className="kp-cover">
          <div className="kp-meta">
            <span>
              {meta.number} от {meta.date}
            </span>
            <span>{meta.company}</span>
          </div>
          <div className="kp-h1">Коммерческое предложение · навесная фасадная система</div>
          <div className="kp-offer">{meta.offer}</div>
          <div className="kp-for">
            Для: <b>{meta.client}</b> · Объект: {objectName}, {objectCity}
          </div>
          <div className="kp-hero-metrics">
            <div>
              <b>{money(est.total)}</b>
              <span>итого с НДС {a.vatRatePct}%</span>
            </div>
            <div>
              <b>{money(est.perM2)}</b>
              <span>₽/м² с НДС</span>
            </div>
            <div>
              <b>{fmtArea(calcResult.netAreaM2)} м²</b>
              <span>чистая площадь</span>
            </div>
          </div>
        </div>

        {/* Исходные данные расчёта */}
        <div className="kp-sec">
          <h3>Исходные данные расчёта</h3>
          <div className="kp-grid4">
            <Metric label="Фасадов" value={`${calcResult.facadeCount} шт`} />
            <Metric label="Валовая площадь" value={`${fmtArea(calcResult.grossAreaM2)} м²`} />
            <Metric
              label="Проёмы"
              value={`${calcResult.openingCount} шт / ${fmtArea(calcResult.openingAreaM2)} м²`}
            />
            <Metric label="Чистая площадь" value={`${fmtArea(calcResult.netAreaM2)} м²`} accent />
          </div>
          <p className="kp-disc">
            Кассеты {calcResult.cassetteType} · {fmtArea(calcResult.cassetteThicknessMm)} мм ·{' '}
            {calcResult.coating} · {calcResult.subsystemLabel} · вентзазор {calcResult.airGapMm} мм ·
            утепление {calcResult.insulationMm} мм + мембрана. Спецификация и стоимость взяты из
            расчёта калькулятора ИНСИ по фактической геометрии фасада.
          </p>
        </div>

        {/* Коммерческие допущения */}
        <div className="kp-sec">
          <h3>Коммерческие допущения</h3>
          <div className="kp-sliders">
            <Slider
              label="Коммерческая скидка"
              value={a.discountPct}
              suffix="%"
              min={0}
              max={12}
              onChange={(v) => set({ discountPct: v })}
            />
            <div className="kp-toggle">
              <span>Монтаж включён</span>
              <button
                className={`toggle ${a.mountingEnabled ? 'on' : ''}`}
                onClick={() => set({ mountingEnabled: !a.mountingEnabled })}
              >
                {a.mountingEnabled ? 'да' : 'нет'}
              </button>
            </div>
            <div className="kp-toggle">
              <span>
                Доставка
                <br />
                <span className="muted">
                  {DELIVERY_ORIGIN} → {objectCity} · {deliveryDistanceKm(objectCity)} км
                </span>
              </span>
              <button
                className={`toggle ${a.deliveryEnabled ? 'on' : ''}`}
                onClick={() => set({ deliveryEnabled: !a.deliveryEnabled })}
              >
                {a.deliveryEnabled ? 'да' : 'нет'}
              </button>
            </div>
            <div className="kp-toggle">
              <span>Проектирование / монтажная схема</span>
              <button
                className={`toggle ${a.designEnabled ? 'on' : ''}`}
                onClick={() => set({ designEnabled: !a.designEnabled })}
              >
                {a.designEnabled ? 'да' : 'нет'}
              </button>
            </div>
          </div>
          <div className="kp-natural">
            <Metric
              label="Закупочная площадь кассет"
              value={`${fmtArea(calcResult.cassetteAreaM2)} м²`}
            />
            <Metric label="Кассеты" value={`${fmtNum(calcResult.cassettePieces)} шт`} />
            <Metric label="Материалы (без НДС)" value={money(calcResult.materialsTotal)} />
          </div>
        </div>

        {/* Спецификация */}
        <div className="kp-sec">
          <h3>Сводная спецификация</h3>
          <table className="kp-table">
            <thead>
              <tr>
                <th>Раздел</th>
                <th>Позиция</th>
                <th className="c">Кол-во</th>
                <th className="r">Цена</th>
                <th className="r">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {est.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.section}</td>
                  <td>{l.name}</td>
                  <td className="c">{l.qty}</td>
                  <td className="r">{l.unitPrice}</td>
                  <td className="r">{l.byProject ? 'по проекту' : money(l.sum)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="kp-totals">
            <div>
              <span>Материалы и работы</span>
              <span>{money(est.subtotal)}</span>
            </div>
            <div>
              <span>Скидка {a.discountPct}%</span>
              <span>−{money(est.discount)}</span>
            </div>
            <div className="net">
              <span>Итого со скидкой (без НДС)</span>
              <span>{money(est.net)}</span>
            </div>
            <div>
              <span>НДС {a.vatRatePct}%</span>
              <span>{money(est.vat)}</span>
            </div>
            <div className="grand">
              <span>Итого с НДС</span>
              <span>{money(est.total)}</span>
            </div>
          </div>
        </div>

        {/* Почему такая цена */}
        <div className="kp-sec">
          <h3>Почему такая цена</h3>
          <div className="kp-bars">
            {est.sections.map((s) => (
              <div key={s.name} className="bar-row">
                <div className="bar-head">
                  <span>{s.name}</span>
                  <b>{money(s.sum)}</b>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(4, (s.sum / maxSection) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Границы поставки */}
        <div className="kp-sec">
          <h3>Границы поставки</h3>
          <div className="kp-scope">
            <ScopeCol title="Что входит" items={meta.whatIn} mark="✅" />
            <ScopeCol title="Не входит" items={meta.whatOut} mark="❌" />
            <ScopeCol title="Риски и допущения" items={meta.risks} mark="⚠" />
          </div>
        </div>

        {/* Условия */}
        <div className="kp-sec">
          <h3>Условия</h3>
          <div className="kp-terms">
            <div>
              <b>{meta.leadTimeDays}</b>
              <span>дней — срок поставки</span>
            </div>
            <div>
              <b>{meta.warrantyMonths}</b>
              <span>мес. гарантии</span>
            </div>
            <div>
              <b>{payment.length}</b>
              <span>этапа оплаты</span>
            </div>
          </div>
          <div className="kp-pay">
            {payment.map((p, i) => (
              <div key={i}>
                <span>
                  {p.name}
                  <br />
                  <span className="muted">{p.when}</span>
                </span>
                <span className="amt">{money(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* О компании */}
        <div className="kp-sec">
          <h3>О системе</h3>
          <p>{meta.pitch}</p>
          <ul className="kp-adv" style={{ marginTop: 14 }}>
            {meta.advantages.map((adv, i) => (
              <li key={i}>{adv}</li>
            ))}
          </ul>
        </div>

        {/* Менеджер + CTA */}
        <div className="kp-sec kp-mgr">
          <div>
            <b>{meta.manager}</b>
            <span>{meta.managerRole}</span>
          </div>
          <div className="kp-mgr-c">
            <a href={`tel:${meta.phone.replace(/\s/g, '')}`}>{meta.phone}</a>
            <a href={`mailto:${meta.email}`}>{meta.email}</a>
          </div>
        </div>
        <div className="kp-cta">
          <button onClick={() => window.print()}>Принять и согласовать</button>
          <p>
            Предложение действительно 14 календарных дней. Цены указаны по прайсу ИНСИ,
            действующему на {meta.date}.
          </p>
        </div>
      </div>
    </div>
  )
}

function sectionShare(est: ReturnType<typeof buildEstimate>, name: string) {
  const s = est.sections.find((x) => x.name === name)?.sum ?? 0
  const all = est.sections.reduce((t, x) => t + x.sum, 0)
  return all > 0 ? s / all : 0
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`metric ${accent ? 'accent' : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function Slider({
  label,
  value,
  suffix,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  suffix: string
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="slider">
      <div className="slider-head">
        <span>{label}</span>
        <b>
          {value}
          {suffix}
        </b>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function ScopeCol({ title, items, mark }: { title: string; items: string[]; mark: string }) {
  return (
    <div className="scope-col">
      <h4>{title}</h4>
      <ul>
        {items.map((it, i) => (
          <li key={i}>
            <span className="scope-mark">{mark}</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    {
      n: 1,
      h: 'Расчёт фасада',
      p: 'Калькулятор ИНСИ считает геометрию, площади и спецификацию по габаритам фасадов и проёмов.',
    },
    {
      n: 2,
      h: 'Спецификация → смета',
      p: 'Натуральные объёмы (кассеты, подсистема, крепёж, утеплитель, мембрана) перемножаются на актуальный прайс.',
    },
    {
      n: 3,
      h: 'Коммерческая модель',
      p: 'Запас, скидка, монтаж, НДС, график оплаты, ₽/м² и декомпозиция стоимости — в реальном времени.',
    },
    {
      n: 4,
      h: 'Готовое КП',
      p: 'Интерактивная веб-страница с границами поставки и кнопкой согласования, готовая к печати в PDF.',
    },
  ]
  return (
    <section className="how">
      <h2>Как это работает</h2>
      <p className="section-sub">Расчёт фасада превращается в коммерческое предложение без ручной сборки.</p>
      <div className="steps">
        {steps.map((s) => (
          <div key={s.n} className="step">
            <div className="step-n">{s.n}</div>
            <div>
              <h4>{s.h}</h4>
              <p>{s.p}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <p>
        Демо-кейс портфолио · калькулятор НВФ ИНСИ → цифровое коммерческое предложение ·{' '}
        <a href="https://github.com/kilevoy/fasad-kp">GitHub</a>
      </p>
      <p className="muted">Андрей Рыкунов · автоматизация фасадных расчётов и КП</p>
    </footer>
  )
}
