import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import '@excalidraw/excalidraw/index.css';
import './index.css';
import { LandingPage } from './landing/LandingPage';
import { SessionGate, SetupRequired } from './workspace/SessionGate';

function Root() {
  const [page, setPage] = useState<'landing' | 'app'>(
    () => window.location.hash === '#app' ? 'app' : 'landing'
  );

  const launch = () => {
    window.location.hash = '#app';
    setPage('app');
  };

  // Handle browser back/forward
  useEffect(() => {
    const onHash = () => setPage(window.location.hash === '#app' ? 'app' : 'landing');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (page === 'app') return <SessionGate />;
  return <LandingPage onLaunch={launch} />;
}

async function start() {
  try {
    const response = await fetch('/amplify_outputs.json');
    if (!response.ok) throw new Error('No Amplify outputs');
    Amplify.configure(await response.json());
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <Authenticator.Provider>
          <Root />
        </Authenticator.Provider>
      </StrictMode>,
    );
  } catch {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <SetupRequired />
      </StrictMode>,
    );
  }
}

void start();
