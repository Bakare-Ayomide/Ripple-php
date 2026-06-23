// Custom full-stack dynamic bridge mapping Supabase queries directly to our SQL Backend
import { resolveUrl } from "@/utils/api";

export interface MockupUser {
  id: string;
  email: string;
  user_metadata: {
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface MockupSession {
  access_token: string;
  user: MockupUser | null;
}

const authListeners = new Set<(event: string, session: MockupSession | null) => void>();

class SupabaseAuth {
  async getUser() {
    const { data, error } = await this.getSession();
    if (error) {
      return { data: { user: null }, error };
    }
    return { data: { user: data.session?.user || null }, error: null };
  }

  async getSession() {
    const token = localStorage.getItem('auth_token');
    const sessionUserStr = localStorage.getItem('auth_user');
    if (!token || !sessionUserStr) {
      return { data: { session: null }, error: null };
    }
    try {
      const user = JSON.parse(sessionUserStr) as MockupUser;
      
      // Validate session with backend to totally reflect deletion/updates from MySQL (phpmyadmin)
      try {
        const res = await fetch(resolveUrl('/api/auth/validate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        if (!res.ok) {
          // If the user was deleted in phpMyAdmin, log them out instantly!
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          authListeners.forEach(cb => cb('SIGNED_OUT', null));
          return { data: { session: null }, error: null };
        }
        const validated = await res.json() as { user: MockupUser };
        localStorage.setItem('auth_user', JSON.stringify(validated.user));
        return {
          data: {
            session: {
              access_token: token,
              user: validated.user
            }
          },
          error: null
        };
      } catch (err) {
        // Fallback silently if offline or database error
        return {
          data: {
            session: {
              access_token: token,
              user
            }
          },
          error: null
        };
      }
    } catch {
      return { data: { session: null }, error: null };
    }
  }

  async signUp({ email, password, options }: { email: string; password?: string; options?: { data?: { username?: string; display_name?: string } } }) {
    const res = await fetch(resolveUrl('/api/auth/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, options })
    });
    if (!res.ok) {
      const text = await res.text();
      return { data: { user: null }, error: new Error(text) };
    }
    const data = await res.json() as { session?: MockupSession; user?: MockupUser };
    if (data.session) {
      localStorage.setItem('auth_token', data.session.access_token);
      localStorage.setItem('auth_user', JSON.stringify(data.session.user));
      authListeners.forEach(cb => cb('SIGNED_IN', data.session || null));
    }
    return { data: { user: data.user || null }, error: null };
  }

  async signInWithPassword({ email, password }: { email: string; password?: string }) {
    const res = await fetch(resolveUrl('/api/auth/signin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const text = await res.text();
      return { data: { session: null, user: null }, error: new Error(text) };
    }
    const data = await res.json() as { session: MockupSession };
    localStorage.setItem('auth_token', data.session.access_token);
    localStorage.setItem('auth_user', JSON.stringify(data.session.user));
    authListeners.forEach(cb => cb('SIGNED_IN', data.session));
    return { data: { session: data.session, user: data.session.user }, error: null };
  }

  async signOut() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    authListeners.forEach(cb => cb('SIGNED_OUT', null));
    return { error: null };
  }

  onAuthStateChange(callback: (event: string, session: MockupSession | null) => void) {
    authListeners.add(callback);
    this.getSession().then(({ data }) => {
      callback('INITIAL_SESSION', data.session);
    }).catch(() => {});
    return {
      data: {
        subscription: {
          unsubscribe() {
            authListeners.delete(callback);
          }
        }
      }
    };
  }

  async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
    const res = await fetch(resolveUrl('/api/auth/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, options })
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: new Error(text) };
    }
    return { error: null };
  }

  async updateUser({ password, data }: { password?: string; data?: any }) {
    const token = localStorage.getItem('auth_token');
    if (!token) return { error: new Error("Not authenticated.") };
    
    // Update local user_metadata in localStorage to sync state instantly
    const userStr = localStorage.getItem('auth_user');
    if (userStr && data) {
      try {
        const u = JSON.parse(userStr);
        u.user_metadata = { ...(u.user_metadata || {}), ...data };
        localStorage.setItem('auth_user', JSON.stringify(u));
        // Trigger auth listeners to propagate state updates across component tree
        authListeners.forEach(cb => cb('USER_UPDATED', { access_token: token, user: u } as any));
      } catch (err) {
        console.warn("Could not update local session user metadata in localStorage", err);
      }
    }

    const res = await fetch(resolveUrl('/api/auth/update-user'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ password, data })
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: new Error(text) };
    }
    return { error: null };
  }
}

class SupabaseStorageBucket {
  private bucket: string;
  private static urlCache = new Map<string, string>();

  constructor(bucket: string) {
    this.bucket = bucket;
  }

  async upload(pathStr: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', pathStr);
    formData.append('bucket', this.bucket);

    const res = await fetch(resolveUrl('/api/storage/upload'), {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: new Error(text) };
    }
    const data = await res.json() as { publicUrl: string };
    SupabaseStorageBucket.urlCache.set(pathStr, data.publicUrl);
    return { data: { path: pathStr }, error: null };
  }

  getPublicUrl(pathStr: string) {
    const cached = SupabaseStorageBucket.urlCache.get(pathStr);
    const resolved = cached || `/uploads/${pathStr.split('/').pop()}`;
    return {
      data: {
        publicUrl: resolveUrl(resolved)
      }
    };
  }
}

class SupabaseStorage {
  from(bucket: string) {
    return new SupabaseStorageBucket(bucket);
  }
}

interface MockAction {
  type: string;
  columns?: string;
  options?: { ascending?: boolean } | null;
  values?: unknown;
  column?: string;
  value?: unknown;
  valuesList?: unknown[];
  operator?: string;
  filter?: string;
  count?: number;
}

class SupabaseQueryBuilder {
  private table: string;
  private actions: MockAction[] = [];

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*", options?: { ascending?: boolean } | null) {
    this.actions.push({ type: 'select', columns, options });
    return this;
  }

  insert(values: unknown) {
    this.actions.push({ type: 'insert', values });
    return this;
  }

  update(values: unknown) {
    this.actions.push({ type: 'update', values });
    return this;
  }

  delete() {
    this.actions.push({ type: 'delete' });
    return this;
  }

  eq(column: string, value: unknown) {
    this.actions.push({ type: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.actions.push({ type: 'neq', column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.actions.push({ type: 'in', column, values });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.actions.push({ type: 'not', column, operator, value });
    return this;
  }

  or(filter: string) {
    this.actions.push({ type: 'or', filter });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.actions.push({ type: 'order', column, options });
    return this;
  }

  limit(count: number) {
    this.actions.push({ type: 'limit', count });
    return this;
  }

  single() {
    this.actions.push({ type: 'single' });
    return this;
  }

  maybeSingle() {
    this.actions.push({ type: 'maybeSingle' });
    return this;
  }

  gt(column: string, value: unknown) {
    this.actions.push({ type: 'gt', column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.actions.push({ type: 'gte', column, value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.actions.push({ type: 'lt', column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.actions.push({ type: 'lte', column, value });
    return this;
  }

  async then<TResult1 = { data: any; error: Error | null; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: Error | null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    try {
      const res = await this.execute();
      if (onfulfilled) return onfulfilled(res);
      return res;
    } catch (e) {
      if (onrejected) return onrejected(e);
      throw e;
    }
  }

  private async execute() {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(resolveUrl('/api/supabase-mock'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          table: this.table,
          actions: this.actions
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return { data: null, error: new Error(errText) };
      }

      const json = await response.json() as { data: unknown; error: { message: string } | null; count?: number };
      return {
        data: json.data,
        error: json.error ? new Error(json.error.message) : null,
        count: json.count
      };
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      return { data: null, error: errorObj };
    }
  }
}

class MockupRealtimeChannel {
  on(event: string, filter: unknown, callback: unknown) {
    return this;
  }
  subscribe() {
    return this;
  }
}

// Exported client matching the application's expected Supabase client interface
export const supabase = {
  auth: new SupabaseAuth(),
  storage: new SupabaseStorage(),
  from(table: string) {
    return new SupabaseQueryBuilder(table);
  },
  channel(name: string) {
    return new MockupRealtimeChannel();
  },
  removeChannel(channel: unknown) {},
  removeAllChannels() {}
};
