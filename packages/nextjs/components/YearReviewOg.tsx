import { OgLogo } from "~~/components/OgLogo";
import { YearReviewFireworks } from "~~/components/YearReviewFireworks";
import {
  formatYearReviewPostTime,
  yearReviewMutualTitle,
  yearReviewSections,
  yearReviewYear,
  type YearReview,
} from "~~/lib/year-review";

const fireworkPositions = [
  { right: 5, top: -15 },
  { right: 79, top: 15 },
  { right: -32, top: 46 },
  { right: 30, top: -29 },
];

function RecapAvatar({ image, size, name }: { image: string | null; size: number; name?: string | null }) {
  const border = { borderRadius: "50%", border: "2px solid #855dcd" };
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" width={size} height={size} style={border} />
  ) : (
    <span
      style={{
        ...border,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        background: "#38244e",
        fontSize: Math.round(size * 0.33),
      }}
    >
      {(name?.slice(0, 2) ?? "FC").toUpperCase()}
    </span>
  );
}

export function YearReviewOg({
  data,
  avatars,
  height = 800,
}: {
  data: YearReview;
  avatars: (string | null)[];
  height?: 600 | 800;
}) {
  const [avatar, ...peerAvatars] = avatars;
  const label = data.profile.username ? `@${data.profile.username}` : `FID ${data.profile.fid}`;
  const sections = yearReviewSections(data);
  const compact = height === 600;
  const avatarSize = compact ? 48 : 64;
  const post = data.topPost;
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
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", width: 348 }}>
          <OgLogo />
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", gap: 5 }}>
          <div style={{ display: "flex", gap: 10, fontWeight: 900, fontSize: compact ? 37 : 46, lineHeight: 1 }}>
            <span style={{ color: "#d6ff3f" }}>{yearReviewYear}</span>
            <span>in review</span>
          </div>
          <div style={{ color: "#c6a9f4", fontSize: compact ? 10 : 12, fontWeight: 700, letterSpacing: 3 }}>
            THE NEW YEAR EDITION
          </div>
        </div>
        <div style={{ display: "flex", width: 348, justifyContent: "flex-end" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderRadius: 50,
              border: "1px solid #5a4279",
              backgroundColor: "#211532",
              padding: "5px 5px 5px 17px",
              fontSize: Math.min(compact ? 27 : 33, Math.floor(840 / label.length)),
              fontWeight: 700,
              color: "#d3bafa",
            }}
          >
            <span style={{ maxWidth: 244, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {label}
            </span>
            <RecapAvatar image={avatar} size={avatarSize} name={data.profile.username} />
          </div>
        </div>
      </div>
      {post && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            position: "relative",
            overflow: "hidden",
            marginTop: compact ? 16 : 25,
            height: compact ? 100 : 128,
            padding: compact ? "12px 18px" : "16px 22px",
            border: "1px solid #654b83",
            borderRadius: 18,
            backgroundImage: "linear-gradient(115deg, #301d48, #1d142a 64%, #2c1b42)",
          }}
        >
          <div style={{ display: "flex", position: "absolute", right: 76, top: -22, opacity: 0.34 }}>
            <YearReviewFireworks width={compact ? 190 : 242} height={compact ? 123 : 157} />
          </div>
          <div style={{ display: "flex", flex: 1, minWidth: 0, flexDirection: "column", gap: compact ? 4 : 7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "#d6ff3f", fontSize: compact ? 15 : 18, fontWeight: 700 }}>Most engaged post</span>
              {post.postedAt && (
                <span style={{ color: "#c8b9da", fontSize: compact ? 12 : 14 }}>
                  {formatYearReviewPostTime(post.postedAt)}
                </span>
              )}
            </div>
            <div
              style={{
                display: "block",
                color: "#f4effa",
                fontSize: compact ? 16 : 19,
                lineHeight: 1.25,
                lineClamp: compact ? 2 : 3,
                wordBreak: "break-word",
              }}
            >
              {post.text
                .replace(/https?:\/\/\S+/gi, "")
                .replace(/\s+/g, " ")
                .trim() || "View the original cast on Farcaster"}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: compact ? 136 : 174,
              alignSelf: "stretch",
              marginLeft: compact ? 17 : 23,
              borderLeft: "1px solid #674d81",
            }}
          >
            <span style={{ color: "#d6ff3f", fontSize: compact ? 32 : 43, fontWeight: 900, lineHeight: 1 }}>
              {post.interactions.toLocaleString("en-US")}
            </span>
            <span style={{ color: "#d8c3ef", fontSize: compact ? 12 : 15, marginTop: 4 }}>interactions</span>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 14, marginTop: post ? (compact ? 12 : 16) : "auto" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            width: 730,
            columnGap: 14,
            rowGap: compact ? 10 : 14,
          }}
        >
          {sections.slice(0, 4).map(({ title, stats, kind }, index) => (
            <div
              key={title}
              style={{
                display: "flex",
                flexDirection: "column",
                position: "relative",
                overflow: "hidden",
                width: 358,
                height: compact ? (index < 2 ? 169 : 149) : index < 2 ? 232 : 200,
                backgroundImage: "linear-gradient(122deg, #1b1328 0%, #20152f 48%, #33204b 100%)",
                border: "1px solid #503960",
                borderRadius: 18,
                padding: compact ? "9px 15px" : "14px 16px",
              }}
            >
              <div style={{ display: "flex", position: "absolute", ...fireworkPositions[index], opacity: 0.4 }}>
                <YearReviewFireworks variant={index + 1} width={compact ? 170 : 222} height={compact ? 110 : 144} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: compact ? 4 : 7 }}>
                <span
                  style={{ color: "#d6ff3f", fontSize: compact ? 13 : 16, fontWeight: 700 }}
                >{`0${index + 1}`}</span>
                <span style={{ fontSize: compact ? 19 : 23, fontWeight: 700, color: "#c6a9f4" }}>{title}</span>
              </div>
              {stats.length ? (
                (kind === "words" ? stats.slice(0, 5) : stats).map(([name, value]) => (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      minHeight: compact ? 21 : 29,
                    }}
                  >
                    <span
                      style={{
                        color: "#d5c9e1",
                        fontSize: compact ? 15 : 18,
                        maxWidth: 237,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {name}
                    </span>
                    <span style={{ fontSize: compact ? 18 : 23, fontWeight: 900 }}>
                      {value.toLocaleString("en-US")}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: "#b9aacb", fontSize: 20 }}>No matching words</div>
              )}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
            width: 360,
            height: compact ? 328 : 446,
            padding: compact ? "10px 15px" : "15px 16px",
            borderRadius: 18,
            border: "1px solid #654b83",
            backgroundImage: "linear-gradient(144deg, #2c1b42, #181120 77%)",
          }}
        >
          <div style={{ display: "flex", position: "absolute", right: -45, bottom: -42, opacity: 0.34 }}>
            <YearReviewFireworks variant={5} width={290} height={188} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#d6ff3f", fontSize: compact ? 13 : 16, fontWeight: 700 }}>05</span>
            <span style={{ color: "#c6a9f4", fontSize: compact ? 20 : 25, fontWeight: 700 }}>
              {yearReviewMutualTitle}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#b9aacb",
              fontSize: compact ? 11 : 13,
              marginTop: 4,
              marginBottom: compact ? 5 : 8,
            }}
          >
            <span>Most two-way connections</span>
            <span>Mutual</span>
          </div>
          {data.mutual.length ? (
            data.mutual.map(({ profile, mutual }, index) => (
              <div
                key={profile.fid}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: compact ? 7 : 10,
                  minHeight: compact ? 35 : 48,
                  borderTop: "1px solid #4b3862",
                }}
              >
                <span style={{ fontSize: compact ? 11 : 13, color: "#ad9cc5" }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <RecapAvatar image={peerAvatars[index] ?? null} size={compact ? 25 : 34} name={profile.username} />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: compact ? 14 : 18,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {profile.username ? `@${profile.username}` : `FID ${profile.fid}`}
                </span>
                <span style={{ fontSize: compact ? 17 : 23, fontWeight: 900, color: "#d6ff3f" }}>
                  {mutual.toLocaleString("en-US")}
                </span>
              </div>
            ))
          ) : (
            <div style={{ color: "#b9aacb", marginTop: 10, fontSize: 15 }}>No mutual interactions captured.</div>
          )}
        </div>
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
