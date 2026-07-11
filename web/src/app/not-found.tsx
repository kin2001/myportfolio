import Link from "next/link";

export default function NotFound() {
  return <main className="content-canvas min-h-screen"><p className="mono-meta accent">ERROR / 404</p><h1 className="mt-8 text-6xl font-semibold">Record not found.</h1><p className="mt-5 ink-soft">The requested page is unavailable or has not been published.</p><Link className="button-primary mt-10" href="/">Return home</Link></main>;
}
