/** Mirrors archiver.manifestChapter from the Go backend. */
export interface ManifestChapter {
  id: string;
  number: number;
  title: string;
  pages: number;
  /** Directory path inside the archive, e.g. "chapters/001". */
  path: string;
  status: 'success' | 'incomplete' | 'failed';
}

/** Mirrors archiver.offtoonManifest from the Go backend (spec_version 1). */
export interface SeriesManifest {
  spec_version: number;
  id: string;
  title: string;
  author: string;
  artist?: string;
  description?: string;
  status?: string;
  genres?: string[];
  rating?: number;
  source?: string;
  source_url?: string;
  /** "cover.webp" when present, undefined otherwise. */
  cover?: string;
  downloaded_at: string;
  chapters: ManifestChapter[];
}

/** What we persist in IndexedDB — the manifest plus runtime metadata. */
export interface LibraryEntry extends SeriesManifest {
  /** Total size of the imported .offtoon file in bytes. */
  sizeBytes: number;
  /** ID of the last chapter the user opened. */
  lastReadChapterId?: string;
  /** Last read page index (0-based) within lastReadChapterId. */
  lastReadPage?: number;
  /** ISO date of the last reading session. */
  lastReadAt?: string;
}

/** Progress event emitted by OfflineStorageService.importOfftoon(). */
export interface ImportProgress {
  phase: 'reading' | 'parsing' | 'extracting' | 'done' | 'error';
  /** 0–100 during 'extracting', undefined for other phases. */
  percent?: number;
  /** Populated on 'done'. */
  entry?: LibraryEntry;
  /** Populated on 'error'. */
  error?: string;
}

/** Reading position persisted per chapter. */
export interface ReadingProgress {
  seriesId: string;
  chapterId: string;
  page: number;
  scrollTop?: number;
  savedAt: string;
}
