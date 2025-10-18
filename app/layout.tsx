import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Neuronix - AI IT Company',
  description: 'Autonomous IT company that creates complete projects from brief to deployment',
  keywords: ['AI', 'automation', 'Next.js', 'GitHub', 'Vercel', 'Claude', 'MCP'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
