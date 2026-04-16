import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'CURO AI — Clinical RAG Assistant',
  description: 'An AI-powered clinical decision support system that uses Retrieval-Augmented Generation to analyze symptoms, retrieve medical literature, and provide evidence-based differential diagnoses.',
  keywords: ['clinical AI', 'medical diagnosis', 'RAG', 'differential diagnosis', 'symptom analysis'],
  authors: [{ name: 'CURO AI' }],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans min-h-screen bg-curo-bg text-curo-text antialiased">
        {/* Animated background mesh */}
        <div className="curo-bg-mesh" aria-hidden="true" />
        {/* Main content */}
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  )
}