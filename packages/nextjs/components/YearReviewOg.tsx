import { OgLogo } from "~~/components/OgLogo";
import { utcDate } from "~~/lib/activity";
import { yearReviewSections, yearReviewYear, type YearReview } from "~~/lib/year-review";

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function YearReviewOg({ data, avatar }: { data: YearReview; avatar: string | null }) {
  const label = data.profile.username ? `@${data.profile.username}` : `FID ${data.profile.fid}`;
  const sections = yearReviewSections(data);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "38px 48px",
        background: "#0d0b12",
        color: "#f4effa",
        fontFamily: "FaralyticsSans",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <OgLogo />
        <div
          style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 700, color: "#b596f2" }}
        >
          <span>{label}</span>
          {avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              width={52}
              height={52}
              style={{ borderRadius: "50%", border: "2px solid #855dcd" }}
            />
          )}
        </div>
      </div>
      <div style={{ fontWeight: 900, fontSize: 70, marginTop: 13 }}>{`${yearReviewYear} in review`}</div>
      <div
        style={{ color: "#b9aacb", fontSize: 20 }}
      >{`Jan 1 through ${monthDay.format(utcDate(data.end))} · UTC`}</div>
      <div style={{ display: "flex", flexWrap: "wrap", columnGap: 16, rowGap: 14, marginTop: 24 }}>
        {sections.map(({ title, stats }, index) => (
          <div
            key={title}
            style={{
              display: "flex",
              flexDirection: "column",
              width: 544,
              height: index < 2 ? 240 : 212,
              background: "#181321",
              border: "1px solid #392a49",
              borderRadius: 18,
              padding: "14px 22px",
            }}
          >
            <div style={{ fontSize: 25, fontWeight: 700, color: index === 0 ? "#d6ff3f" : "#b596f2", marginBottom: 7 }}>
              {title}
            </div>
            {stats.length ? (
              stats.map(([name, value]) => (
                <div
                  key={name}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 29 }}
                >
                  <span style={{ color: "#d5c9e1", fontSize: 20 }}>{name}</span>
                  <span style={{ fontSize: 24, fontWeight: 900 }}>{value.toLocaleString("en-US")}</span>
                </div>
              ))
            ) : (
              <div style={{ color: "#b9aacb", fontSize: 20 }}>No matching words</div>
            )}
          </div>
        ))}
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", color: "#aa9db9", fontSize: 16 }}
      >
        <div>Captured history · older activity may be missing</div>
        <div>created with viniapp</div>
      </div>
    </div>
  );
}
