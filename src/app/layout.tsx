import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Traceform — Code Review That Actually Runs',
  description:
    'Traceform is an autonomous AI agent that checks out PR branches, executes tests, writes targeted verification tests, and posts execution-backed reviews to GitHub. Every claim is backed by a trace, not a guess.',
  keywords: ['AI', 'code review', 'GitHub', 'PR', 'agent', 'testing', 'traceform'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
