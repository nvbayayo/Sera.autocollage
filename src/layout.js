import "./globals.css";

export const metadata = {
  title: "Sera AutoCollage",
  description: "Local browser-based automatic collage maker",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
