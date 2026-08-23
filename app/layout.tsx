import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Family Home Evening Rotation",
  description: "Manage family home evening tasks and assignments",
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
        <footer style={{ borderTop: `1px solid var(--color-taupe)`, marginTop: '3rem' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal)' }}>
              FHE Rotation is free and always will be. If it's useful to your family, 
              consider <a href="https://ko-fi.com/ammonspiffy3" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>giving me a tip</a> to help fund hosting, new features, and future projects.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}


