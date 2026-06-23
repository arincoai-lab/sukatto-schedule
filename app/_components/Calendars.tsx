// カレンダー3強（Google/Outlook/iCloud）への同時登録 + 外部ICS閲覧。

const CALENDARS = [
  { name: "Google カレンダー", color: "#4285F4", write: true },
  { name: "Outlook / Microsoft 365", color: "#0078D4", write: true },
  { name: "iCloud カレンダー", color: "#34c759", write: true },
];

export default function Calendars() {
  return (
    <section className="section">
      <div className="wrap">
        <span className="eyebrow">どこへでも、一度に</span>
        <h2 className="section-title">3つのカレンダーに、同時登録。</h2>
        <p className="lead">
          仕事はOutlook、家族はGoogle、個人はiCloud——分かれていても大丈夫。選んだカレンダーすべてに一度で入ります。
          TimeTreeなど外部カレンダーは公開URL（.ics）で閲覧もできます。
        </p>
        <div className="cal-band">
          {CALENDARS.map((c) => (
            <span key={c.name} className="cal-pill">
              <span className="swatch" style={{ background: c.color }} aria-hidden />
              {c.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
