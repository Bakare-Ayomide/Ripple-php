// Local SQLite-esque Database emulation layer using standard IndexedDB for robust local storage.
// This allows caching full post responses so they load instantly and work offline/under heavy network conditions.

import { PostWithProfile } from "@/hooks/usePosts";

const DB_NAME = "ripple_sqlite_local";
const STORE_NAME = "posts_cache";
const DB_VERSION = 1;

export class LocalSQLitePostStore {
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (evt) => {
        console.error("[LocalSQLite] Database opening error:", request.error);
        reject(request.error);
      };

      request.onsuccess = (evt) => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (evt: any) => {
        const db = evt.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          // Store raw post details along with their nested profile maps
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
    });
  }

  /**
   * Insert or update a list of posts into local SQLite cache
   */
  async savePosts(posts: PostWithProfile[]): Promise<void> {
    if (!posts || posts.length === 0) return;

    try {
      const db = await this.init();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        posts.forEach((post) => {
          // Normalize to preserve profiles and likes state
          store.put(post);
        });

        transaction.oncomplete = () => {
          resolve();
        };

        transaction.onerror = () => {
          console.warn("[LocalSQLite] Failed to store posts batch", transaction.error);
          reject(transaction.error);
        };
      });
    } catch (err) {
      console.warn("[LocalSQLite] Save posts aborted:", err);
    }
  }

  /**
   * Retrieve all cached posts ordered by date descending
   */
  async getPosts(): Promise<PostWithProfile[]> {
    try {
      const db = await this.init();
      return new Promise<PostWithProfile[]>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const posts = request.result as PostWithProfile[];
          // Sort descending by created_at like the main API order
          posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          resolve(posts);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (err) {
      console.warn("[LocalSQLite] Retrieve posts aborted:", err);
      return [];
    }
  }

  /**
   * Deactivates/clears stale feed cache
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.init();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn("[LocalSQLite] Clear posts aborted:", err);
    }
  }
}

export const localSqlite = new LocalSQLitePostStore();
