import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KinStack Finance",
  description: "Your business finances, in focus.",
  icons: {
    icon: "/kinstack-logo.png",
    shortcut: "/kinstack-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
