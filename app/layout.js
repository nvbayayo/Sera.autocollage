import "./globals.css";

export const metadata = {
  title: "Sera Auto Collage",
  description: "MLBB collage editor with automatic grid detection",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
