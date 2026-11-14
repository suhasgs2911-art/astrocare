import { auth } from '../firebase';

export async function getFirebaseIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required: no signed-in Firebase user.');
  }
  return user.getIdToken();
}

export async function authorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const idToken = await getFirebaseIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${idToken}`);
  return fetch(input, {
    ...init,
    headers,
  });
}
