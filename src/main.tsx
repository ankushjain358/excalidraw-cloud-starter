import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import '@excalidraw/excalidraw/index.css';
import './index.css';
import App from './App';

function SetupRequired() {
  return <main className="grid min-h-screen place-items-center bg-stone-950 p-6 text-stone-100"><section className="max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-8"><h1 className="text-2xl font-semibold">Connect your workspace</h1><p className="mt-3 text-stone-400">Run <code>npx ampx sandbox</code> to generate <code>amplify_outputs.json</code>, then restart Vite. Authentication and cloud workspace access are disabled until a backend is deployed.</p></section></main>;
}

async function start() {
  try {
    const response = await fetch('/amplify_outputs.json');
    if (!response.ok) throw new Error('No Amplify outputs');
    Amplify.configure(await response.json());
    createRoot(document.getElementById('root')!).render(<StrictMode><Authenticator><App /></Authenticator></StrictMode>);
  } catch {
    createRoot(document.getElementById('root')!).render(<StrictMode><SetupRequired /></StrictMode>);
  }
}

void start();
