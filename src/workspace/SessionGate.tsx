import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import WorkspaceApp from './WorkspaceApp';

function AuthenticatorHeader() {
  return (
    <div className="auth-brand">
      <img src="/src/assets/logo.png" alt="logo" className="auth-mark" />
      <div>
        <p>excalidraw-cloud-starter</p>
        <span>Your private drawing workspace</span>
      </div>
    </div>
  );
}

export function SetupRequired() {
  return (
    <main className="grid min-h-screen place-items-center bg-stone-950 p-6 text-stone-100">
      <section className="max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-8">
        <h1 className="text-2xl font-semibold">Connect your workspace</h1>
        <p className="mt-3 text-stone-400">
          Run <code>npx ampx sandbox</code> to generate{' '}
          <code>amplify_outputs.json</code>, then restart Vite. Authentication
          and cloud workspace access are disabled until a backend is deployed.
        </p>
      </section>
    </main>
  );
}

export function SessionGate() {
  const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus]);
  if (authStatus === 'authenticated') return <WorkspaceApp />;
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Authenticator components={{ Header: AuthenticatorHeader }} />
      </section>
    </main>
  );
}
