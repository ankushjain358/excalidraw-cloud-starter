import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import '@excalidraw/excalidraw/index.css';
import './index.css';
import outputs from '../amplify_outputs.json';
import { LandingPage } from './landing/LandingPage';
import { SessionGate } from './workspace/SessionGate';

Amplify.configure(outputs);

function Root() {
  const [page, setPage] = useState<'landing' | 'app'>(
    () => window.location.hash === '#app' ? 'app' : 'landing'
  );

  const launch = () => {
    window.location.hash = '#app';
    setPage('app');
  };

  useEffect(() => {
    const onHash = () => setPage(window.location.hash === '#app' ? 'app' : 'landing');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (page === 'app') return <SessionGate />;
  return <LandingPage onLaunch={launch} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Authenticator.Provider>
      <Root />
    </Authenticator.Provider>
  </StrictMode>,
);
