import type { Metadata, Viewport } from "next";
import { MiniappProvider } from "~~/components/MiniappProvider";
import "~~/styles/globals.css";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d0b12",
};
export const metadata: Metadata = {
  title: "Faralytics — your Farcaster activity",
  description: "Your year, one purple square at a time. Explore and share captured Farcaster activity.",
  icons: { icon: "/icon.svg?v=accent1" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MiniappProvider>{children}</MiniappProvider>
      </body>
    </html>
  );
}
