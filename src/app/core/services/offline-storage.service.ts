import {inject, Injectable, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {Observable, Subject} from 'rxjs';
import {unzip} from 'fflate';
import {ImportProgress, LibraryEntry, ManifestChapter, ReadingProgress, SeriesManifest} from '@core/models/library.model';
import {LibraryDbService} from './library-db.service';

const OPFS_ROOT_DIR = 'offtoon';

/** Ranking used when the same chapter arrives in more than one archive. */
const CHAPTER_STATUS_RANK: Record<ManifestChapter['status'], number> = {
  success: 2,
  incomplete: 1,
  failed: 0,
};

/**
 * Merges a freshly imported series into the copy already in the library.
 *
 * Archives are produced one download at a time, but the manifest id is the
 * series slug — so importing chapters 1-10 and then 11-20 describes one work and
 * must yield a single entry holding all 20. Without this, the second import
 * would replace the first: its chapters would vanish from the UI while their
 * images stayed behind in OPFS, unreachable.
 *
 * Rules:
 *  - Chapters are unioned by id and re-sorted by number. When a chapter is in
 *    both archives the better outcome wins (success > incomplete > failed), so
 *    re-importing a partially failed chapter can only improve it. On a tie the
 *    incoming copy wins, since its images were just written to OPFS.
 *  - Series metadata comes from the incoming manifest, falling back to the
 *    existing value rather than regressing a field to undefined.
 *  - Reading position is runtime state rather than manifest data, so it is
 *    always carried over — importing more chapters must not lose the user's place.
 */
export function mergeSeriesEntry(existing: LibraryEntry, incoming: LibraryEntry): LibraryEntry {
  const byId = new Map<string, ManifestChapter>();
  for (const ch of existing.chapters) byId.set(ch.id, ch);

  for (const ch of incoming.chapters) {
    const prev = byId.get(ch.id);
    if (!prev || CHAPTER_STATUS_RANK[ch.status] >= CHAPTER_STATUS_RANK[prev.status]) {
      byId.set(ch.id, ch);
    }
  }

  return {
    ...existing,
    ...incoming,
    chapters:    [...byId.values()].sort((a, b) => a.number - b.number),
    cover:       incoming.cover       ?? existing.cover,
    author:      incoming.author      || existing.author,
    artist:      incoming.artist      ?? existing.artist,
    description: incoming.description ?? existing.description,
    status:      incoming.status      ?? existing.status,
    genres:      incoming.genres      ?? existing.genres,
    rating:      incoming.rating      ?? existing.rating,
    source_url:  incoming.source_url  ?? existing.source_url,
    sizeBytes:   existing.sizeBytes + incoming.sizeBytes,
    lastReadChapterId: existing.lastReadChapterId,
    lastReadPage:      existing.lastReadPage,
    lastReadAt:        existing.lastReadAt,
  };
}

/**
 * Main storage facade for the offline library.
 *
 * Images are stored in OPFS (Origin Private File System) for fast, quota-aware
 * binary storage. Series metadata is indexed in IndexedDB via LibraryDbService
 * for queryable, reactive access.
 *
 * All public methods are browser-only. Callers in SSR-aware contexts must guard
 * with isPlatformBrowser before calling.
 */
@Injectable({providedIn: 'root'})
export class OfflineStorageService {

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly db = inject(LibraryDbService);

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  /**
   * Imports a .offtoon file into local storage. Emits ImportProgress events
   * as it progresses through reading, parsing, extracting and indexing.
   * The Observable completes after emitting 'done' or 'error'.
   */
  importOfftoon(file: File): Observable<ImportProgress> {
    const subject = new Subject<ImportProgress>();

    if (!this.isBrowser) {
      subject.next({phase: 'error', error: 'import is browser-only'});
      subject.complete();
      return subject.asObservable();
    }

    this.runImport(file, subject).catch(err => {
      subject.next({phase: 'error', error: String(err)});
      subject.complete();
    });

    return subject.asObservable();
  }

  private async runImport(file: File, subject: Subject<ImportProgress>): Promise<void> {
    // 1. Read the file into memory.
    subject.next({phase: 'reading'});
    const buffer = await file.arrayBuffer();

    // 2. Decompress the ZIP (fflate, async callback).
    subject.next({phase: 'parsing'});
    const files = await unzipAsync(new Uint8Array(buffer));

    // 3. Parse manifest.json.
    const manifestBytes = files['manifest.json'];
    if (!manifestBytes) throw new Error('manifest.json not found in archive');
    const manifest: SeriesManifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    if (!manifest.id) throw new Error('manifest.json is missing required field "id"');

    // 4. Write all entries to OPFS, emitting progress per file.
    subject.next({phase: 'extracting', percent: 0});
    const opfsDir = await getOrCreateSeriesDir(manifest.id);
    const entries = Object.entries(files).filter(([name]) => name !== 'manifest.json');
    let done = 0;

    for (const [name, data] of entries) {
      await writeOpfsFile(opfsDir, name, data);
      done++;
      subject.next({phase: 'extracting', percent: Math.round((done / entries.length) * 100)});
    }

    // 5. Persist metadata in IndexedDB, folding the archive into any earlier
    //    import of the same series so separately downloaded chapters accumulate
    //    instead of the newer archive replacing the older one.
    const imported: LibraryEntry = {
      ...manifest,
      sizeBytes: file.size,
    };
    const previous = await this.db.getSeries(manifest.id);
    const entry = previous ? mergeSeriesEntry(previous, imported) : imported;
    await this.db.upsertSeries(entry);

    subject.next({phase: 'done', entry});
    subject.complete();
  }

  // ---------------------------------------------------------------------------
  // Library queries
  // ---------------------------------------------------------------------------

  async getLibrary(): Promise<LibraryEntry[]> {
    if (!this.isBrowser) return [];
    const all = await this.db.getAllSeries();
    return all.sort((a, b) =>
      new Date(b.downloaded_at).getTime() - new Date(a.downloaded_at).getTime()
    );
  }

  async getSeries(id: string): Promise<LibraryEntry | undefined> {
    if (!this.isBrowser) return undefined;
    return this.db.getSeries(id);
  }

  /** Reading progress for every chapter of a series the user has opened, keyed by chapter id. */
  async getSeriesProgress(id: string): Promise<Map<string, ReadingProgress>> {
    if (!this.isBrowser) return new Map();
    return this.db.getSeriesProgress(id);
  }

  async filterBySource(source: string): Promise<LibraryEntry[]> {
    if (!this.isBrowser) return [];
    return this.db.queryByIndex('source', source);
  }

  async filterByStatus(status: string): Promise<LibraryEntry[]> {
    if (!this.isBrowser) return [];
    return this.db.queryByIndex('status', status);
  }

  // ---------------------------------------------------------------------------
  // Image access
  // ---------------------------------------------------------------------------

  /**
   * Returns a blob: URL for a file stored in OPFS.
   * filePath is relative to the series root, e.g. "chapters/001/001.webp" or "cover.webp".
   * The caller must revoke the URL with URL.revokeObjectURL() when done to avoid leaks.
   */
  async getImageUrl(seriesId: string, filePath: string): Promise<string> {
    const opfsDir = await getOrCreateSeriesDir(seriesId);
    const file = await readOpfsFile(opfsDir, filePath);
    return URL.createObjectURL(file);
  }

  /**
   * Reads all page images for a chapter in order.
   * Returns blob URLs — caller must revoke them all when the chapter is unmounted.
   */
  async getChapterImageUrls(seriesId: string, chapterPath: string, pageCount: number): Promise<string[]> {
    const opfsDir = await getOrCreateSeriesDir(seriesId);
    const urls: string[] = [];
    for (let i = 1; i <= pageCount; i++) {
      // Try common extensions in order; the actual extension is embedded in the path
      // so we search the directory entries instead.
      const file = await findPageFile(opfsDir, chapterPath, i);
      if (file) urls.push(URL.createObjectURL(file));
    }
    return urls;
  }

  // ---------------------------------------------------------------------------
  // Deletion
  // ---------------------------------------------------------------------------

  async deleteSeries(id: string): Promise<void> {
    if (!this.isBrowser) return;
    await this.db.deleteSeries(id);
    try {
      const root = await navigator.storage.getDirectory();
      const rootDir = await root.getDirectoryHandle(OPFS_ROOT_DIR, {create: false});
      await rootDir.removeEntry(id, {recursive: true});
    } catch {
      // Directory may not exist if the import was partial; ignore.
    }
  }

  /**
   * Deletes a single chapter: its images in OPFS, its metadata and its progress.
   *
   * Files go first — if the metadata were removed first and the file deletion
   * then failed, the images would be orphaned with nothing left pointing at them.
   * A missing directory is not an error: the import may have been partial.
   *
   * Returns the updated series entry.
   */
  async deleteChapter(seriesId: string, chapter: ManifestChapter): Promise<LibraryEntry | undefined> {
    if (!this.isBrowser) return undefined;
    try {
      const seriesDir = await getOrCreateSeriesDir(seriesId);
      const parts = chapter.path.split('/').filter(Boolean);
      const leaf = parts.pop();
      if (leaf) {
        let dir = seriesDir;
        for (const part of parts) dir = await dir.getDirectoryHandle(part, {create: false});
        await dir.removeEntry(leaf, {recursive: true});
      }
    } catch {
      // Directory already gone — fall through and clean up the metadata anyway.
    }
    return this.db.deleteChapter(seriesId, chapter.id);
  }

  // ---------------------------------------------------------------------------
  // Storage quota
  // ---------------------------------------------------------------------------

  async getStorageEstimate(): Promise<{used: number; quota: number}> {
    if (!this.isBrowser || !navigator.storage?.estimate) return {used: 0, quota: 0};
    const {usage = 0, quota = 0} = await navigator.storage.estimate();
    return {used: usage, quota};
  }

  /**
   * Asks the browser to mark this origin's storage as persistent, so the library
   * is not silently evicted when the device runs low on space.
   *
   * This matters most on WebKit, which clears script-writable storage (IndexedDB,
   * OPFS) after roughly a week without a visit — long enough that a user could
   * lose their whole downloaded library over a holiday. Safari does not grant
   * persistence on request, though: it decides from engagement signals, and
   * installing to the Home Screen is what actually protects the data. So a false
   * result here is normal on iOS and must not be surfaced as an error.
   *
   * Returns the resulting persisted state, or false when unsupported.
   */
  async requestPersistentStorage(): Promise<boolean> {
    if (!this.isBrowser || !navigator.storage?.persist) return false;
    try {
      if (await navigator.storage.persisted?.()) return true;
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }

  /** Whether this origin's storage is already exempt from eviction. */
  async isStoragePersisted(): Promise<boolean> {
    if (!this.isBrowser || !navigator.storage?.persisted) return false;
    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// OPFS helpers
// ---------------------------------------------------------------------------

async function getOrCreateSeriesDir(seriesId: string): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const offtoonDir = await root.getDirectoryHandle(OPFS_ROOT_DIR, {create: true});
  return offtoonDir.getDirectoryHandle(seriesId, {create: true});
}

/**
 * Writes data to a (possibly nested) path inside a base directory.
 * Creates intermediate directories as needed.
 * e.g. writeOpfsFile(base, "chapters/001/001.webp", bytes)
 */
async function writeOpfsFile(base: FileSystemDirectoryHandle, path: string, data: Uint8Array): Promise<void> {
  const parts = path.split('/').filter(Boolean);
  const filename = parts.pop()!;
  let dir = base;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, {create: true});
  }
  const fh = await dir.getFileHandle(filename, {create: true});
  const writable = await fh.createWritable();
  await writable.write(data);
  await writable.close();
}

/**
 * Reads a file at a (possibly nested) path inside a base directory.
 */
async function readOpfsFile(base: FileSystemDirectoryHandle, filePath: string): Promise<File> {
  const parts = filePath.split('/').filter(Boolean);
  const filename = parts.pop()!;
  let dir = base;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, {create: false});
  }
  const fh = await dir.getFileHandle(filename, {create: false});
  return fh.getFile();
}

/**
 * Finds a page image inside a chapter directory.
 * Page files are named "001.webp", "001.jpg", etc. We list the directory
 * entries and match by zero-padded page index.
 */
async function findPageFile(base: FileSystemDirectoryHandle, chapterPath: string, pageIndex: number): Promise<File | null> {
  const parts = chapterPath.split('/').filter(Boolean);
  let dir = base;
  try {
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, {create: false});
    }
    const prefix = String(pageIndex).padStart(3, '0');
    for await (const [name, handle] of (dir as any)) {
      if (handle.kind === 'file' && (name as string).startsWith(prefix)) {
        return (handle as FileSystemFileHandle).getFile();
      }
    }
  } catch {
    // Chapter directory not found.
  }
  return null;
}

// ---------------------------------------------------------------------------
// fflate helper
// ---------------------------------------------------------------------------

function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(data, (err, files) => {
      if (err) reject(err);
      else resolve(files);
    });
  });
}
