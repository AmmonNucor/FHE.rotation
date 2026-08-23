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
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="mt-12 pt-6 border-t border-gray-300 text-center text-sm text-gray-600 max-w-2xl mx-auto px-4 py-6">
          <p>
            FHE Rotation is free and always will be. If it's useful to your family, 
            consider <a href="https://ko-fi.com/ammonspiffy3" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-900">giving me a tip</a> to help fund hosting and new features.
          </p>
        </footer>
      </body>
    </html>
  );
}


