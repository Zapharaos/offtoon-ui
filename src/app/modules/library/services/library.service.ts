import {inject, Injectable, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {BehaviorSubject, Observable} from 'rxjs';
import {LibraryEntry, ManifestChapter} from '@core/models/library.model';
import {OfflineStorageService} from '@core/services/offline-storage.service';

export type LibrarySortKey = 'recent' | 'title' | 'rating' | 'chapters';
export type LibraryFilterStatus = 'all' | 'ongoing' | 'completed' | 'hiatus' | 'dropped';

export type SeriesStatusSeverity = 'success' | 'warn' | 'danger' | 'secondary' | 'info';

/**
 * Severity and label for a series status tag. Shared by the library cards and
 * the detail dialog so the same status never renders two different ways.
 */
export function seriesStatusSeverity(status?: string): SeriesStatusSeverity {
  switch (status) {
    case 'completed': return 'success';
    case 'ongoing':   return 'info';
    case 'hiatus':    return 'warn';
    case 'dropped':   return 'danger';
    default:          return 'secondary';
  }
}

export function seriesStatusLabel(status?: string): string {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
}

@Injectable({providedIn: 'root'})
export class LibraryService {

  private readonly storage = inject(OfflineStorageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _entries$ = new BehaviorSubject<LibraryEntry[]>([]);
  private readonly _loading$ = new BehaviorSubject(false);

  readonly entries$: Observable<LibraryEntry[]> = this._entries$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  get entries(): LibraryEntry[] { return this._entries$.value; }

  async load(): Promise<void> {
    if (!this.isBrowser) return;
    this._loading$.next(true);
    try {
      const all = await this.storage.getLibrary();
      this._entries$.next(all);
    } finally {
      this._loading$.next(false);
    }
  }

  pushEntry(entry: LibraryEntry): void {
    const current = this._entries$.value;
    const idx = current.findIndex(e => e.id === entry.id);
    if (idx >= 0) {
      const updated = [...current];
      updated[idx] = entry;
      this._entries$.next(updated);
    } else {
      this._entries$.next([entry, ...current]);
    }
  }

  async deleteSeries(id: string): Promise<void> {
    await this.storage.deleteSeries(id);
    this._entries$.next(this._entries$.value.filter(e => e.id !== id));
  }

  /**
   * Deletes one chapter and its images, freeing space without dropping the whole
   * series. Removing the last chapter removes the series too — an entry with no
   * chapters left is not something the user can do anything with.
   *
   * Returns the updated entry, or null when the series was removed entirely.
   */
  async deleteChapter(seriesId: string, chapter: ManifestChapter): Promise<LibraryEntry | null> {
    const updated = await this.storage.deleteChapter(seriesId, chapter);
    if (!updated || updated.chapters.length === 0) {
      await this.deleteSeries(seriesId);
      return null;
    }
    this.pushEntry(updated);
    return updated;
  }

  filter(entries: LibraryEntry[], search: string, status: LibraryFilterStatus, source: string): LibraryEntry[] {
    const q = search.trim().toLowerCase();
    return entries.filter(e => {
      if (q && !e.title.toLowerCase().includes(q) && !e.author.toLowerCase().includes(q)) return false;
      if (status !== 'all' && e.status !== status) return false;
      if (source && e.source !== source) return false;
      return true;
    });
  }

  sort(entries: LibraryEntry[], key: LibrarySortKey): LibraryEntry[] {
    return [...entries].sort((a, b) => {
      switch (key) {
        case 'title':   return a.title.localeCompare(b.title);
        case 'rating':  return (b.rating ?? 0) - (a.rating ?? 0);
        case 'chapters': return b.chapters.length - a.chapters.length;
        default:        return new Date(b.downloaded_at).getTime() - new Date(a.downloaded_at).getTime();
      }
    });
  }

  sources(): string[] {
    return [...new Set(this._entries$.value.map(e => e.source).filter(Boolean))] as string[];
  }
}
