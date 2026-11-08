import "server-only";
import { unstable_cache } from "next/cache";
import { join } from "node:path";
import sharp from "sharp";
import { OgLogo } from "~~/components/OgLogo";
import { cloudHeight, cloudWidth, cloudWordColor, cloudWordSize, packWords } from "~~/lib/word-cloud-layout";
import { readGlobalWordCloud, readWordCloud } from "~~/lib/word-cloud-data";
import {
  wordCloudPeriods,
  wordCloudRange,
  type GlobalWordCloudSelection,
  type WordCloudData,
  type WordCloudSelection,
} from "~~/lib/word-cloud";

const face = join(process.cwd(), "assets/fonts/FaralyticsOG-Bold.ttf");

async function renderCloud(words: WordCloudData["words"], height: number) {
  const top = words[0]?.[1] || 1;
  const rasters = await Promise.all(
    words.slice(0, 52).map(async ([word, count], index) => {
      const size = cloudWordSize(word, count, top, height);
      const safeWord = word.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      const color = cloudWordColor(index);
      const raster = await sharp({
        text: {
          text: `<span foreground="${color}">${safeWord}</span>`,
          font: `FaralyticsOG Bold ${size}`,
          fontfile: face,
          dpi: 72,
          rgba: true,
        },
      })
        .png()
        .toBuffer({ resolveWithObject: true });
      return { ...raster, fontSize: size };
    }),
  );

  const placements = packWords(
    rasters.map(({ info, fontSize }) => ({ ...info, fontSize })),
    height,
  );
  const layers = await Promise.all(
    placements.map(async ({ index, left, top, width, height, angle }) => {
      const { data, info } = rasters[index];
      let input = data;
      const targetWidth = angle ? height : width;
      const targetHeight = angle ? width : height;
      if (info.width !== targetWidth || info.height !== targetHeight)
        input = await sharp(input).resize(targetWidth, targetHeight, { fit: "fill" }).png().toBuffer();
      if (angle) input = await sharp(input).rotate(angle).png().toBuffer();
      return { left, top, input };
    }),
  );
  return sharp({ create: { width: cloudWidth, height, channels: 4, background: "#00000000" } })
    .composite(layers)
    .png()
    .toBuffer();
}

export const readWordCloudPng = unstable_cache(
  async (fid: string, selection: WordCloudSelection, height = cloudHeight) => {
    const { words } = await readWordCloud(fid, selection);
    return (await renderCloud(words, height)).toString("base64");
  },
  ["word-cloud-png-v2"],
  { revalidate: 300 },
);

const renderGlobalWordCloudPng = unstable_cache(
  async (words: WordCloudData["words"]) => (await renderCloud(words, cloudHeight)).toString("base64"),
  ["global-word-cloud-png-v1"],
  { revalidate: 3600 },
);

export async function readGlobalWordCloudPng(selection: GlobalWordCloudSelection) {
  const { words } = await readGlobalWordCloud(selection);
  return renderGlobalWordCloudPng(words);
}

export async function prepareWordCloudArtwork(fid: string, selection: WordCloudSelection, height = 800) {
  const data = await readWordCloud(fid, selection);
  const label = data.profile.username ? `@${data.profile.username}` : `FID ${data.profile.fid}`;
  const compact = height === 600;
  const imageHeight = compact ? 336 : cloudHeight;
  const png = data.words.length
    ? await (compact ? readWordCloudPng(fid, selection, imageHeight) : readWordCloudPng(fid, selection))
    : null;
  const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
  return {
    data,
    label,
    artwork: (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#0d0b12",
          color: "#f4effa",
          padding: compact ? "26px 48px" : "38px 48px",
          fontFamily: "FaralyticsSans",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <OgLogo />
          <div style={{ color: "#b596f2", fontSize: 29, fontWeight: 700 }}>{label}</div>
        </div>
        <div style={{ fontSize: compact ? 41 : 51, fontWeight: 900, marginTop: compact ? 14 : 24 }}>
          Most-used words
        </div>
        <div style={{ fontSize: 22, color: "#aa9db9", marginTop: 4 }}>
          {`${wordCloudPeriods[selection.period]} · ${wordCloudRange(selection)}`}
        </div>
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 16,
            border: "2px solid #30263c",
            borderRadius: 22,
            background: "#14101c",
          }}
        >
          {png ? (
            // ImageResponse accepts the embedded raster without the browser image pipeline.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/png;base64,${png}`} width={cloudWidth} height={imageHeight} alt="" />
          ) : (
            <div style={{ color: "#aa9db9", fontSize: 23 }}>No matching words in this period.</div>
          )}
        </div>
        <div
          style={{ display: "flex", justifyContent: "space-between", fontSize: 17, color: "#aa9db9", marginTop: 12 }}
        >
          <div>{`${data.casts.toLocaleString("en-US")} captured casts with text · older text may be missing`}</div>
          <div>{`created with viniapp · ${generatedAt} UTC`}</div>
        </div>
      </div>
    ),
  };
}
