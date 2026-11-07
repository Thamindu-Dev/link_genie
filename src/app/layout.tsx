import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LinkGenie — Subscribe to Unlock Content Gate",
  description:
    "Secure, minimalist content gating for creators and educators. Share locked lecture & video links with one click.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="min-h-screen bg-zinc-950 font-sans text-zinc-100 relative overflow-x-hidden">
        {/* Ambient Background Glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 overflow-hidden z-0"
        >
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[480px] w-[780px] rounded-full bg-indigo-600/15 blur-[130px]" />
          <div className="absolute bottom-[-180px] right-[-100px] h-[400px] w-[500px] rounded-full bg-emerald-500/10 blur-[140px]" />
          <div className="absolute inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]" />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}

