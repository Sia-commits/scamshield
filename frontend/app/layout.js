import "./globals.css";

export const metadata = {
  title: "Scam Check — We spot scams before you click",
  description: "Check messages, screenshots, Instagram profiles, Telegram bots and emails for scams",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
