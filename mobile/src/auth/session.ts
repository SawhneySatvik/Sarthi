/**
 * Auth is dependency-injected so local/fake mode does not need Supabase or SecureStore,
 * while the production adapter can persist only the opaque session payload in SecureStore.
 */
export type NativeSession = {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAtMs?: number;
  onboardingComplete: boolean;
};

export type SecureSessionStore = {
  get(): Promise<NativeSession | null>;
  set(session: NativeSession): Promise<void>;
  clear(): Promise<void>;
};

export type AuthGateway = {
  signUp(input: { email: string; password: string }): Promise<NativeSession>;
  signIn(input: { email: string; password: string }): Promise<NativeSession>;
  requestPasswordReset(input: { email: string; redirectTo: string }): Promise<void>;
  updatePassword(input: { password: string }): Promise<void>;
  signOut(): Promise<void>;
};

export type AuthSnapshot = { status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; session: NativeSession };

export class NativeAuthController {
  private snapshot: AuthSnapshot = { status: 'loading' };
  private listeners = new Set<(snapshot: AuthSnapshot) => void>();

  constructor(private readonly gateway: AuthGateway, private readonly store: SecureSessionStore) {}

  subscribe(listener: (snapshot: AuthSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  private publish(snapshot: AuthSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }

  async restore(): Promise<AuthSnapshot> {
    const session = await this.store.get();
    this.publish(session ? { status: 'signed-in', session } : { status: 'signed-out' });
    return this.snapshot;
  }

  async signIn(input: { email: string; password: string }): Promise<NativeSession> {
    const session = await this.gateway.signIn(input);
    await this.store.set(session);
    this.publish({ status: 'signed-in', session });
    return session;
  }

  async signUp(input: { email: string; password: string }): Promise<NativeSession> {
    const session = await this.gateway.signUp(input);
    await this.store.set(session);
    this.publish({ status: 'signed-in', session });
    return session;
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    await this.gateway.requestPasswordReset({ email, redirectTo });
  }

  async updatePassword(password: string): Promise<void> {
    await this.gateway.updatePassword({ password });
  }

  async signOut(): Promise<void> {
    try {
      await this.gateway.signOut();
    } finally {
      await this.store.clear();
      this.publish({ status: 'signed-out' });
    }
  }
}
