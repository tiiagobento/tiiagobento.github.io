import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nova Forma CRM",
  description: "CRM comercial para leads de obras em steel frame.",
  applicationName: "Nova Forma CRM",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Nova Forma CRM",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/nova-forma-icon.svg",
    apple: "/icons/nova-forma-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b2530",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <PwaRegister />
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
