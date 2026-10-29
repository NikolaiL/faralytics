
import type { Metadata } from "next";

const EMBED_LIMITS = { BUTTON_TITLE: 32, ACTION_NAME: 32, URL: 1024 } as const;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return max > 1 ? str.slice(0, max - 1) + "…" : str.slice(0, max);
}

function clampUrl(url: string, max: number = EMBED_LIMITS.URL): string {
  if (url.length <= max) return url;
  console.warn(`[fc:miniapp] URL exceeds ${max} char limit (${url.length}): ${url.slice(0, 80)}…`);
  return url.slice(0, max);
}

function buildMiniappEmbed(
  imageUrl: string,
  imageRelativePath: string,
  title: string,
  baseUrl: string,
  actionName?: string,
  actionRelativeUrl?: string,
): string {
  const miniappBaseUrl = getMiniappBaseUrl(baseUrl);
  const miniappImageUrl = getMiniappImageUrl(baseUrl, imageRelativePath);
  const miniappActionUrl = actionRelativeUrl
    ? new URL(actionRelativeUrl, miniappBaseUrl).toString()
    : miniappBaseUrl;
  const buttonTitle = truncate(actionName || process.env.NEXT_PUBLIC_APP_NAME || title, EMBED_LIMITS.BUTTON_TITLE);
  const appName = truncate(actionName || title || process.env.NEXT_PUBLIC_APP_NAME || "", EMBED_LIMITS.ACTION_NAME);
  return JSON.stringify({
    version: "1",
    imageUrl: clampUrl(miniappImageUrl || imageUrl || process.env.NEXT_PUBLIC_IMAGE_URL || ""),
    button: {
      title: buttonTitle,
      action: {
        url: clampUrl(miniappActionUrl),
        type: "launch_miniapp",
        name: appName,
        splashImageUrl: process.env.NEXT_PUBLIC_APP_SPLASH_IMAGE || new URL("/favicon.png", miniappBaseUrl).toString(),
        splashBackgroundColor: process.env.NEXT_PUBLIC_SPLASH_BACKGROUND_COLOR || "#212638",
      },
    },
  });
}

function getMiniappBaseUrl(baseUrl: string): string {
  return process.env.NEXT_PUBLIC_URL || baseUrl;
}

function getMiniappImageUrl(baseUrl: string, imageRelativePath: string): string {
  return new URL(imageRelativePath, getMiniappBaseUrl(baseUrl)).toString();
}


const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : `http://localhost:${process.env.PORT || 3000}`;
const titleTemplate = "%s";

export const getMetadata = ({
  title,
  description,
  imageRelativePath = "/opengraph-image",
}: {
  title: string;
  description: string;
  imageRelativePath?: string;
}): Metadata => {
  const imageUrl = `${baseUrl}${imageRelativePath}`;

  return {
  metadataBase: new URL(getMiniappBaseUrl(baseUrl)),
  title: {
    default: title,
    template: titleTemplate
  },
  description: description,
  openGraph: {
    title: {
      default: title,
      template: titleTemplate
    },
    description: description,
    images: [
      {
        url: getMiniappImageUrl(baseUrl, imageRelativePath)
      }
    ]
  },
  twitter: {
    title: {
      default: title,
      template: titleTemplate
    },
    description: description,
    images: [
      getMiniappImageUrl(baseUrl, imageRelativePath)
    ]
  },
  icons: {
    icon: [
      {
        url: '/favicon.png',
        sizes: '32x32',
        type: 'image/png'
      }
    ]
  },
  other: {
    'fc:miniapp': buildMiniappEmbed(imageUrl, imageRelativePath, title, baseUrl)
  }
};
}