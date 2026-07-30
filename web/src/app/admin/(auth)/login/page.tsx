import { getSupabasePublicConfig } from "@/lib/env";

const errors: Record<string, string> = {
  not_allowed: "This Google account is not approved for portfolio administration.",
  not_configured: "Supabase authentication is not configured yet.",
  oauth_start_failed: "Google sign-in could not start. Try again.",
  oauth_callback_failed: "Google sign-in could not be completed. Try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = Boolean(getSupabasePublicConfig());
  return (
    <main className="flex min-h-screen items-center px-5 py-12">
      <div className="mx-auto w-full max-w-lg">
        <p className="mono-meta accent">[ OWNER_AUTHENTICATION ]</p>
        <h1 className="mt-5 text-4xl font-semibold">Private access</h1>
        <p className="mt-4 leading-7 ink-soft">Only the two approved Google accounts can open the portfolio control area.</p>
        <section className="module mt-10 p-8" aria-labelledby="google-login-title">
          <h2 id="google-login-title" className="text-2xl font-medium">Continue securely</h2>
          <p className="mt-3 leading-7 ink-soft">Google verifies your identity. Supabase then checks your immutable administrator ID.</p>
          {error ? <p className="mt-6 text-sm text-[var(--danger)]" role="alert">{errors[error] ?? "Sign-in failed."}</p> : null}
          {configured ? (
            <a className="button-primary mt-8 w-full" href="/auth/login">Continue with Google</a>
          ) : (
            <button className="button-primary mt-8 w-full" type="button" disabled>Authentication not configured</button>
          )}
        </section>
        <a className="mono-label accent mt-8 inline-flex min-h-11 items-center" href="/">Return to public site</a>
      </div>
    </main>
  );
}
