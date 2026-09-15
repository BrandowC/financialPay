import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { QueryProvider } from '@/lib/query-provider';
import { Toaster } from '@/components/ui/Toaster';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'AM Cuenta · Panel administrativo',
  description: 'Panel para administrar los saldos de los clientes de AM Cuenta',
  robots: { index: false, follow: false }, // panel interno: nunca debe indexarse
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans">
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
