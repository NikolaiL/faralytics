import { OgLogo } from "~~/components/OgLogo";
import { YearReviewFireworks } from "~~/components/YearReviewFireworks";
import { utcDate } from "~~/lib/activity";
import { yearReviewSections, yearReviewYear, type YearReview } from "~~/lib/year-review";

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function YearReviewOg({
  data,
  avatar,
  height = 800,
}: {
  data: YearReview;
  avatar: string | null;
  height?: 600 | 800;
}) {
  const label = data.profile.username ? `@${data.profile.username}` : `FID ${data.profile.fid}`;
  const sections = yearReviewSections(data);
  const compact = height === 600;
  const avatarSize = compact ? 48 : 64;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: compact ? "22px 48px" : "32px 48px",
        backgroundImage: "linear-gradient(155deg, #201431 0%, #0d0b12 48%, #100b17 100%)",
        color: "#f4effa",
        fontFamily: "FaralyticsSans",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <OgLogo />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            borderRadius: 50,
            border: "1px solid #5a4279",
            backgroundColor: "#211532",
            padding: "5px 5px 5px 17px",
            fontSize: Math.min(compact ? 27 : 33, Math.floor(840 / label.length)),
            fontWeight: 700,
            color: "#d3bafa",
          }}
        >
          <span>{label}</span>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              width={avatarSize}
              height={avatarSize}
              style={{ borderRadius: "50%", border: "2px solid #855dcd" }}
            />
          ) : (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: avatarSize,
                height: avatarSize,
                borderRadius: "50%",
                border: "2px solid #855dcd",
                background: "#38244e",
                fontSize: 20,
              }}
            >
              {(data.profile.username?.slice(0, 2) ?? "FC").toUpperCase()}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", position: "relative", flexDirection: "column", paddingTop: compact ? 9 : 16 }}>
        <div style={{ position: "absolute", right: 120, top: 4, display: "flex" }}>
          <YearReviewFireworks width={compact ? 182 : 250} height={compact ? 118 : 162} />
        </div>
        <div style={{ color: "#d6ff3f", fontSize: compact ? 12 : 15, fontWeight: 700, letterSpacing: 4 }}>
          THE NEW YEAR EDITION
        </div>
        <div style={{ display: "flex", gap: 20, fontWeight: 900, fontSize: compact ? 55 : 77 }}>
          <span style={{ color: "#d6ff3f" }}>{yearReviewYear}</span>
          <span>in review</span>
        </div>
        <div style={{ color: "#c8b9da", fontSize: compact ? 15 : 19 }}>
          {`Jan 1 through ${monthDay.format(utcDate(data.end))} · UTC`}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          columnGap: 16,
          rowGap: compact ? 10 : 14,
          marginTop: compact ? 14 : 25,
        }}
      >
        {sections.map(({ title, stats }, index) => (
          <div
            key={title}
            style={{
              display: "flex",
              flexDirection: "column",
              position: "relative",
              overflow: "hidden",
              width: 544,
              height: compact ? (index < 2 ? 169 : 149) : index < 2 ? 232 : 200,
              backgroundImage: "linear-gradient(122deg, #1b1328 0%, #20152f 48%, #33204b 100%)",
              border: "1px solid #503960",
              borderRadius: 18,
              padding: compact ? "9px 22px" : "14px 22px",
            }}
          >
            <div style={{ display: "flex", position: "absolute", top: compact ? 6 : 16, right: 79, opacity: 0.48 }}>
              <YearReviewFireworks width={compact ? 197 : 257} height={compact ? 127 : 166} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: compact ? 4 : 7 }}>
              <span style={{ color: "#d6ff3f", fontSize: compact ? 13 : 16, fontWeight: 700 }}>{`0${index + 1}`}</span>
              <span style={{ fontSize: compact ? 20 : 25, fontWeight: 700, color: "#c6a9f4" }}>{title}</span>
            </div>
            {stats.length ? (
              stats.map(([name, value]) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    minHeight: compact ? 21 : 29,
                  }}
                >
                  <span style={{ color: "#d5c9e1", fontSize: compact ? 16 : 20 }}>{name}</span>
                  <span style={{ fontSize: compact ? 19 : 24, fontWeight: 900 }}>{value.toLocaleString("en-US")}</span>
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
