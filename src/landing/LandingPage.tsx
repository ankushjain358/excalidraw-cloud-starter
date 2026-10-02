import { Cloud, FolderOpen, Lock, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoUrl from '../assets/logo.png';

const GITHUB_URL = 'https://github.com/ankushjain358/excalidraw-cloud-starter';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

const features = [
  { icon: Lock, title: 'Private & authenticated', description: 'Every workspace is protected by Cognito authentication. Your drawings are yours alone.' },
  { icon: FolderOpen, title: 'Folders & organisation', description: 'Group drawings into folders. Rename, move, and delete with a clean workspace UI.' },
  { icon: Cloud, title: 'Cloud file storage', description: 'Scene data is stored in S3 under a stable per-user prefix. Survives Cognito migrations.' },
  { icon: RefreshCw, title: 'Cross-device sync', description: 'Open any drawing from any device. Revision tracking prevents silent overwrites.' },
];

const stack = [
  { name: 'AWS Amplify Gen 2', description: 'Backend-as-code: auth, data, storage' },
  { name: 'Amazon Cognito', description: 'User authentication & identity' },
  { name: 'AWS AppSync', description: 'GraphQL API with Lambda resolvers' },
  { name: 'Amazon DynamoDB', description: 'Workspace metadata storage' },
  { name: 'Amazon S3', description: 'Scene & file byte storage' },
  { name: 'React + Vite', description: 'Fast frontend with shadcn/ui' },
];

type Props = { onLaunch: () => void };

export function LandingPage({ onLaunch }: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="logo" className="size-8 rounded-lg bg-white" />
            <span className="font-semibold tracking-tight">excalidraw-cloud-starter</span>
          </div>
          <nav className="ml-auto flex items-center gap-3">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="lg" className="gap-2">
                <GithubIcon className="size-4" />GitHub
              </Button>
            </a>
            <Button size="lg" onClick={onLaunch}>Sign in</Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
          <span className="size-2 rounded-full bg-green-500" />
          Self-hosted · Open source · AWS Amplify Gen 2
        </div>
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Your private cloud<br />
          <span className="text-muted-foreground">Excalidraw workspace</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          A self-hosted starter that wraps{' '}
          <a href="https://excalidraw.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">Excalidraw</a>
          {' '}with private authentication, folders, S3 file storage, and cross-device drawing sync — all powered by AWS Amplify Gen 2.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" className="px-8 text-base" onClick={onLaunch}>Try it now</Button>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline" className="gap-2 px-8 text-base">
              <GithubIcon className="size-4" />View on GitHub
            </Button>
          </a>
        </div>


      </section>

      {/* Features */}
      <section className="border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">Everything you need</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border bg-background p-6">
                <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-foreground/5">
                  <Icon className="size-5" />
                </div>
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="mb-3 text-center text-3xl font-bold tracking-tight">Built with</h2>
          <p className="mb-12 text-center text-muted-foreground">Production-grade AWS services wired together with Amplify Gen 2 backend-as-code.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stack.map(({ name, description }) => (
              <div key={name} className="flex items-start gap-4 rounded-xl border p-5">
                <div className="mt-0.5 size-2 shrink-0 rounded-full bg-foreground" />
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Credit to Excalidraw */}
      <section className="border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by{' '}
            <a href="https://excalidraw.com" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-4 hover:no-underline">
              Excalidraw
            </a>
            {' '}— the open-source virtual whiteboard for sketching hand-drawn like diagrams.{' '}
            <a href="https://github.com/excalidraw/excalidraw" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4 hover:no-underline">
              excalidraw/excalidraw <ExternalLink className="size-3" />
            </a>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <h2 className="text-4xl font-bold tracking-tight">Ready to start drawing?</h2>
          <p className="mt-4 text-muted-foreground">Sign in to access your private cloud workspace.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="px-10 text-base" onClick={onLaunch}>Get started</Button>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="gap-2 px-8 text-base">
                <GithubIcon className="size-4" />Star on GitHub
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 items-center justify-center rounded bg-foreground text-background font-bold text-xs">E</div>
            <span className="text-sm font-medium">excalidraw-cloud-starter</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Open source under MIT.{' '}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
              GitHub
            </a>
          </p>
          <p className="text-sm text-muted-foreground">
            Drawing powered by{' '}
            <a href="https://excalidraw.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
              Excalidraw
            </a>
          </p>
        </div>
      </footer>

    </div>
  );
}
