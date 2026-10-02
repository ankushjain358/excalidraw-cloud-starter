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
