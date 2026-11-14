import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { verifyFirebaseIdToken } from '../firebaseAdmin.ts';

declare global {
  namespace Express {
    interface Request {
      uid?: string;
      firebaseUser?: DecodedIdToken;
    }
  }
}

export async function requireFirebaseAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const match =
    typeof authHeader === 'string' ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
  const idToken = match?.[1]?.trim();

  if (!idToken) {
    res.status(401).json({
      error: 'Unauthorized: Missing or malformed Authorization Bearer token.',
    });
    return;
  }

  try {
    const decodedToken = await verifyFirebaseIdToken(idToken);
    if (!decodedToken.uid) {
      res.status(401).json({
        error: 'Unauthorized: Verified token is missing a subject UID.',
      });
      return;
    }

    req.uid = decodedToken.uid;
    req.firebaseUser = decodedToken;
    next();
  } catch {
    res.status(401).json({
      error: 'Unauthorized: Invalid or expired Firebase ID token.',
    });
  }
}
