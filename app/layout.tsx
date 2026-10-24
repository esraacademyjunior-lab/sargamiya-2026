import "./globals.css";

export const metadata = {
  title: "Sargamiya 2026 | ESRA Global Science Academy",
  description: "Sargamiya 2026 — Annual Arts Fest at ESRA Global Science Academy"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}