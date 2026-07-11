export default function LoginPage() {
  return (
    <div className="mx-auto max-w-lg py-12">
      <p className="mono-meta accent">[ OWNER_AUTHENTICATION ]</p><h1 className="mt-5 text-4xl font-semibold">Private access</h1><p className="mt-4 leading-7 ink-soft">Supabase email/password and TOTP verification will protect this area after backend configuration.</p>
      <form className="module mt-10 space-y-7 p-8"><label className="block"><span className="mono-label">Email</span><input className="field mt-2" type="email" autoComplete="email" /></label><label className="block"><span className="mono-label">Password</span><input className="field mt-2" type="password" autoComplete="current-password" /></label><button className="button-primary w-full" type="button" disabled>Authentication not connected</button></form>
    </div>
  );
}
