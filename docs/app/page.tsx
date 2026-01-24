import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-4xl font-bold mb-4">ZAP Rust</h1>
      <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
        A Rust implementation of ZAP - the insanely fast data interchange format
        and capability-based RPC system.
      </p>
      <Link
        href="/docs"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
      >
        Get Started
      </Link>
    </main>
  );
}
