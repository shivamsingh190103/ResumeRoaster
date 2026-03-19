import "./globals.css";

export const metadata = {
  title: "Resume Roaster",
  description:
    "Brutally honest, genuinely useful AI resume feedback for Indian CS students and job seekers.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
