import { BackButton } from "@/components/back-button";

export default function NotFound() {
  return <main data-public-error className="content-canvas min-h-screen"><BackButton /><p className="mono-meta accent">ERROR / 404</p><h1 className="public-display mt-8">Record not found.</h1><p className="public-body mt-5">The requested page is unavailable or has not been published.</p></main>;
}
