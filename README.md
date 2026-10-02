# excalidraw-cloud-starter

A self-hosted cloud workspace starter for [Excalidraw](https://excalidraw.com) with private authentication, folders, file storage, and cross-device drawing sync.

Built with React, Vite, AWS Amplify Gen 2, Amazon Cognito, AppSync, DynamoDB, S3, and shadcn/ui.

---

## Deploy your own in minutes

The fastest way to get your own instance running is to connect this repository to AWS Amplify Hosting. Amplify will provision the entire backend (auth, API, database, storage) and deploy the frontend automatically on every push.

### 1. Fork the repository

Click **Fork** on GitHub to create your own copy of this repo.

### 2. Connect to AWS Amplify Hosting

1. Open the [AWS Amplify Console](https://console.aws.amazon.com/amplify).
2. Click **Create new app** → **Host web app**.
3. Choose **GitHub** and authorize Amplify to access your forked repo.
4. Select the repo and the `main` branch.
5. Amplify will auto-detect the build settings from `amplify.yml` in the repo root.
6. Click **Save and deploy**.

Amplify will:
- Provision a Cognito User Pool for authentication
- Create an AppSync GraphQL API
- Set up DynamoDB tables for workspace metadata
- Create an S3 bucket for scene and file storage
- Deploy the React frontend to a global CDN

Your app will be live at the Amplify-provided URL (e.g. `https://main.xxxxxx.amplifyapp.com`) within a few minutes.

### 3. Custom domain (optional)

In the Amplify Console, go to **App settings → Domain management** and add your own domain. Amplify handles SSL automatically.

---

## Local development

### Prerequisites

- Node.js 18+
- AWS account with permissions to deploy Amplify Gen 2 backends
- AWS CLI configured (`aws configure`)

### Setup

```bash
# Install dependencies
npm install

# Start the Amplify sandbox backend (runs in watch mode)
npx ampx sandbox
```

The sandbox command provisions a personal cloud backend and generates `amplify_outputs.json` in the project root. Keep this terminal running.

```bash
# In a second terminal, start the dev server
npm run dev
```

Open `http://localhost:5173`. Sign up for an account and start drawing.

> **Note:** Never commit `amplify_outputs.json` — it contains environment-specific backend endpoints. It is already in `.gitignore`.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript |
| UI | shadcn/ui, Tailwind CSS, lucide-react |
| Drawing | [Excalidraw](https://github.com/excalidraw/excalidraw) |
| Auth | Amazon Cognito (via Amplify Gen 2) |
| API | AWS AppSync (GraphQL) |
| Database | Amazon DynamoDB |
| Storage | Amazon S3 |
| Backend-as-code | AWS Amplify Gen 2 |
| Hosting | AWS Amplify Hosting |

---

## Architecture

- **Stable user identity** — `User.id` is a UUID generated on first login. Cognito issuer/subject pairs are linked through an `IdentityLink` table. S3 keys are namespaced under `users/{User.id}/...` and survive Cognito migrations.
- **Workspace metadata** — `Folder` and `WorkspaceFile` models are stored in DynamoDB and accessed via AppSync direct model operations.
- **Scene storage** — Drawing scenes are stored as JSON in S3. Each save writes a new revision key, preventing silent overwrites from concurrent edits.
- **Lambda resolvers** — Only operations that require S3 access (create, load, save drawing, read/write file bytes) go through a Lambda function. All other CRUD uses the Amplify model client directly.
- **No browser S3 access** — All S3 reads and writes are mediated by the Lambda resolver. The browser never holds S3 credentials.
- **5 MB limit** — Scene and file byte payloads are capped at 5 MB by the backend.

---

## Credits

Drawing powered by [Excalidraw](https://excalidraw.com) — the open-source virtual whiteboard for sketching hand-drawn like diagrams. ([excalidraw/excalidraw](https://github.com/excalidraw/excalidraw))
