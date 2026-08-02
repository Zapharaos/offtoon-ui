import {Injectable} from '@angular/core';
import {LibraryEntry, ReadingProgress} from '@core/models/library.model';

const DB_NAME = 'offtoon-library';
const DB_VERSION = 1;
const STORE_SERIES = 'series';
const STORE_PROGRESS = 'progress';

/**
 * Thin IndexedDB wrapper for the offline library.
 * Stores LibraryEntry objects (series metadata) and ReadingProgress records.
 * All methods are Promise-based and browser-only — guard with isPlatformBrowser
 * before calling from SSR-aware contexts.
 */
@Injectable({providedIn: 'root'})
export class LibraryDbService {

  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_SERIES)) {
          const store = db.createObjectStore(STORE_SERIES, {keyPath: 'id'});
          store.createIndex('title', 'title', {unique: false});
          store.createIndex('source', 'source', {unique: false});
          store.createIndex('status', 'status', {unique: false});
          store.createIndex('downloaded_at', 'downloaded_at', {unique: false});
        }
        if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
          const pStore = db.createObjectStore(STORE_PROGRESS, {keyPath: ['seriesId', 'chapterId']});
          pStore.createIndex('seriesId', 'seriesId', {unique: false});
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  async upsertSeries(entry: LibraryEntry): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SERIES, 'readwrite');
      tx.objectStore(STORE_SERIES).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllSeries(): Promise<LibraryEntry[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SERIES, 'readonly');
      const req = tx.objectStore(STORE_SERIES).getAll();
      req.onsuccess = () => resolve(req.result as LibraryEntry[]);
      req.onerror = () => reject(req.error);
    });
  }

  async getSeries(id: string): Promise<LibraryEntry | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SERIES, 'readonly');
      const req = tx.objectStore(STORE_SERIES).get(id);
      req.onsuccess = () => resolve(req.result as LibraryEntry | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteSeries(id: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SERIES, STORE_PROGRESS], 'readwrite');
      tx.objectStore(STORE_SERIES).delete(id);
      // Delete all progress records for this series via cursor on the index.
      const idx = tx.objectStore(STORE_PROGRESS).index('seriesId');
      const curReq = idx.openCursor(IDBKeyRange.only(id));
      curReq.onsuccess = () => {
        const cursor = curReq.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Removes one chapter from a series and drops its reading progress.
   *
   * When the deleted chapter was the one being read, the lastRead* fields are
   * cleared too — leaving them would point "Continue reading" at a chapter whose
   * images no longer exist.
   *
   * Returns the updated entry so callers can refresh the library view.
   */
  async deleteChapter(seriesId: string, chapterId: string): Promise<LibraryEntry | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SERIES, STORE_PROGRESS], 'readwrite');
      const store = tx.objectStore(STORE_SERIES);
      let updated: LibraryEntry | undefined;

      const getReq = store.get(seriesId);
      getReq.onsuccess = () => {
        const entry = getReq.result as LibraryEntry | undefined;
        if (!entry) return;
        entry.chapters = entry.chapters.filter(c => c.id !== chapterId);
        if (entry.lastReadChapterId === chapterId) {
          delete entry.lastReadChapterId;
          delete entry.lastReadPage;
          delete entry.lastReadAt;
        }
        store.put(entry);
        updated = entry;
      };

      tx.objectStore(STORE_PROGRESS).delete([seriesId, chapterId]);

      tx.oncomplete = () => resolve(updated);
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveProgress(progress: ReadingProgress): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SERIES, STORE_PROGRESS], 'readwrite');

      // Persist progress record.
      tx.objectStore(STORE_PROGRESS).put(progress);

      // Update lastRead* fields on the LibraryEntry.
      const getReq = tx.objectStore(STORE_SERIES).get(progress.seriesId);
      getReq.onsuccess = () => {
        const entry = getReq.result as LibraryEntry | undefined;
        if (entry) {
          entry.lastReadChapterId = progress.chapterId;
          entry.lastReadPage = progress.page;
          entry.lastReadAt = progress.savedAt;
          tx.objectStore(STORE_SERIES).put(entry);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Returns every reading-progress record for a series, keyed by chapter id.
   *
   * LibraryEntry only remembers the single most recent chapter, so this is what
   * lets the UI mark every chapter the user has already opened rather than just
   * the last one.
   */
  async getSeriesProgress(seriesId: string): Promise<Map<string, ReadingProgress>> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROGRESS, 'readonly');
      const idx = tx.objectStore(STORE_PROGRESS).index('seriesId');
      const req = idx.getAll(IDBKeyRange.only(seriesId));
      req.onsuccess = () => {
        const byChapter = new Map<string, ReadingProgress>();
        for (const p of req.result as ReadingProgress[]) byChapter.set(p.chapterId, p);
        resolve(byChapter);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getProgress(seriesId: string, chapterId: string): Promise<ReadingProgress | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROGRESS, 'readonly');
      const req = tx.objectStore(STORE_PROGRESS).get([seriesId, chapterId]);
      req.onsuccess = () => resolve(req.result as ReadingProgress | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  /** Queries the series store by a single indexed field. */
  async queryByIndex(indexName: 'source' | 'status', value: string): Promise<LibraryEntry[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SERIES, 'readonly');
      const req = tx.objectStore(STORE_SERIES).index(indexName).getAll(IDBKeyRange.only(value));
      req.onsuccess = () => resolve(req.result as LibraryEntry[]);
      req.onerror = () => reject(req.error);
    });
  }
}
