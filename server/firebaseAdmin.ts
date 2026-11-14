import fs from 'node:fs';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

function resolveProjectId(): string {
  const fromEnv =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }

  try {
    const configUrl = new URL('../firebase-applet-config.json', import.meta.url);
    const raw = fs.readFileSync(configUrl, 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (parsed.projectId && parsed.projectId.trim()) {
      return parsed.projectId.trim();
    }
  } catch {
    // Fall through if config file is unavailable
  }

  throw new Error(
    'Unable to resolve Firebase projectId for Firebase Admin SDK initialization.'
  );
}

function createAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = resolveProjectId();

  // Optional runtime environment service account JSON (never hardcoded in source)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson && serviceAccountJson.trim()) {
    const parsed = JSON.parse(serviceAccountJson) as ServiceAccount;
    return initializeApp({
      credential: cert(parsed),
      projectId: parsed.projectId || projectId,
    });
  }

  // Use Application Default Credentials when configured via GOOGLE_APPLICATION_CREDENTIALS
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  // Public-key JWT verification for Firebase Auth ID tokens requires only projectId
  return initializeApp({ projectId });
}

export const adminApp = createAdminApp();
export const adminAuth = getAuth(adminApp);

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  return adminAuth.verifyIdToken(idToken);
}
