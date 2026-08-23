import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import KofiWidget from './components/KofiWidget'


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
              consuder a donation to help support hosting, new features, and new projects.
            </p>
          </div>
        </footer>
<Script 
  src="https://storage.ko-fi.com/cdn/scripts/overlay-widget.js"
  onLoad={() => {
    if (typeof (window as any).kofiWidgetOverlay !== 'undefined') {
      (window as any).kofiWidgetOverlay.draw('ammonspiffy3', {
        'type': 'floating-chat',
        'floating-chat.donateButton.text': 'Support Me',
        'floating-chat.donateButton.background-color': '#5cb85c',
        'floating-chat.donateButton.text-color': '#fff'
      });
    }
  }}
/>
      </body>
    </html>
  );
}
