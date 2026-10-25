import type { Metadata, Viewport } from "next"
import { Nunito, Outfit } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const bodyFont = Nunito({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
})

const displayFont = Outfit({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Mía's K-pop Party",
    template: "%s · Mía's K-pop Party",
  },
  description:
    "Invitación al cumpleaños número 10 de Mía: una fiesta K-pop con música, juegos y sorpresas.",
  applicationName: "Mía's K-pop Party",
  // Las invitaciones son privadas: no deben aparecer en buscadores.
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a0b2e",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-GT"
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
