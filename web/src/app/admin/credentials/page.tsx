export default function CredentialsAdminPage() {
  return (
    <div className="max-w-6xl">
      <div className="flex flex-col gap-6 border-b border-[var(--line)] pb-8 md:flex-row md:items-end md:justify-between"><div><p className="mono-meta accent">[ CREDENTIAL_CONTROL ]</p><h1 className="mt-4 text-4xl font-semibold">Credentials</h1></div><button className="button-primary" type="button">Add credential</button></div>
      <div className="module mt-8 p-10"><p className="mono-meta accent">VERIFICATION_GATE / ACTIVE</p><h2 className="mt-6 text-2xl font-medium">No credentials recorded.</h2><p className="mt-3 max-w-2xl leading-7 ink-soft">Each record will require an issuer, issue date, verification link, demonstrated skills, and a related project before publication.</p></div>
    </div>
  );
}
