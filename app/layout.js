import "./globals.css";

export const metadata = {
  title: "Sera Skin Collage",
  description: "Free Mobile Legends skin collage maker"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
