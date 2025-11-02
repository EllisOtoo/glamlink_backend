import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, DecodedIdToken, getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private readonly app?: App;
  private readonly auth?: Auth;
  private readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.normalizePrivateKey(
      this.configService.get<string>('FIREBASE_PRIVATE_KEY'),
    );

    this.configured = Boolean(projectId && clientEmail && privateKey);

    if (!this.configured) {
      this.logger.warn(
        'Firebase credentials are not fully configured. Firebase-auth endpoints will fail.',
      );
      return;
    }

    this.app =
      getApps().length === 0
        ? initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          })
        : getApp();

    this.auth = getAuth(this.app);
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.configured || !this.auth) {
      throw new Error('Firebase admin SDK is not configured.');
    }

    return this.auth.verifyIdToken(idToken, true);
  }

  private normalizePrivateKey(privateKey?: string): string | undefined {
    if (!privateKey) {
      return undefined;
    }

    return privateKey.replace(/\\n/g, '\n');
  }
}
