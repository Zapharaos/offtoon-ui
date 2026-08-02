import {
  AfterViewInit,
  Component,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import {Router} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {Subscription} from 'rxjs';

import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {SelectModule} from 'primeng/select';
import {TagModule} from 'primeng/tag';
import {DialogModule} from 'primeng/dialog';
import {SkeletonModule} from 'primeng/skeleton';
import {ConfirmDialogModule} from 'primeng/confirmdialog';
import {TooltipModule} from 'primeng/tooltip';
import {DividerModule} from 'primeng/divider';
import {ConfirmationService, MessageService} from 'primeng/api';
import {ToastModule} from 'primeng/toast';

import {LibraryEntry, ManifestChapter, ReadingProgress} from '@core/models/library.model';
import {OfflineStorageService} from '@core/services/offline-storage.service';
import {
  LibraryFilterStatus,
  LibraryService,
  LibrarySortKey,
  SeriesStatusSeverity,
  seriesStatusLabel,
  seriesStatusSeverity,
} from '../../services/library.service';
import {ImportZoneComponent} from '../../components/import-zone/import-zone.component';
import {SeriesCardComponent} from '../../components/series-card/series-card.component';

interface SortOption { label: string; value: LibrarySortKey; }
interface StorageInfo { used: number; quota: number; percent: number; usedLabel: string; quotaLabel: string; }

@Component({
  selector: 'app-library-home',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, SelectModule, TagModule, DialogModule,
    SkeletonModule, ConfirmDialogModule, TooltipModule, DividerModule, ToastModule,
    ImportZoneComponent, SeriesCardComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './library-home.component.html',
  styleUrl: './library-home.component.scss',
})
export class LibraryHomeComponent implements OnInit, AfterViewInit, OnDestroy {

  private readonly library   = inject(LibraryService);
  private readonly storage   = inject(OfflineStorageService);
  private readonly confirm   = inject(ConfirmationService);
  private readonly msg       = inject(MessageService);
  private readonly router    = inject(Router);
  private readonly zone      = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private sub: Subscription | null = null;

  // ── State ─────────────────────────────────────────────────────────────────

  allEntries: LibraryEntry[] = [];
  displayed: LibraryEntry[] = [];
  loading = true;

  search = '';
  selectedStatus: LibraryFilterStatus = 'all';
  selectedSource = '';
  selectedSort: LibrarySortKey = 'recent';
  availableSources: string[] = [];
  sourceOptions: {label: string; value: string}[] = [];

  showImport = false;
  selectedEntry: LibraryEntry | null = null;
  showDetail = false;
  detailCoverUrl: string | null = null;
  private detailCoverBlob = '';
  storage_: StorageInfo = {used: 0, quota: 0, percent: 0, usedLabel: '0 B', quotaLabel: '0 B'};

  /** Reading progress for the open series, keyed by chapter id. */
  private detailProgress = new Map<string, ReadingProgress>();

  /** Shown on iOS until the user installs, since only installed web apps survive eviction. */
  showInstallHint = false;

  readonly statusOptions: {label: string; value: LibraryFilterStatus}[] = [
    {label: 'All statuses', value: 'all'},
    {label: 'Ongoing',      value: 'ongoing'},
    {label: 'Completed',    value: 'completed'},
    {label: 'Hiatus',       value: 'hiatus'},
    {label: 'Dropped',      value: 'dropped'},
  ];

  readonly sortOptions: SortOption[] = [
    {label: 'Recently added', value: 'recent'},
    {label: 'Title A–Z',      value: 'title'},
    {label: 'Top rated',      value: 'rating'},
    {label: 'Most chapters',  value: 'chapters'},
  ];

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.sub = this.library.entries$.subscribe(entries => {
      this.allEntries = entries;
      this.availableSources = this.library.sources();
      this.sourceOptions = [
        {label: 'All sources', value: ''},
        ...this.availableSources.map(s => ({label: s, value: s})),
      ];
      this.applyFilters();
    });
    this.library.load().then(() => { this.loading = false; });
    this.refreshStorageInfo();
    if (this.isBrowser) {
      this.refreshInstallHint();
      window.addEventListener('beforeinstallprompt', this.onBeforeInstallPrompt);
      window.addEventListener('appinstalled', this.onAppInstalled);
    }
  }

  // ── Storage persistence ────────────────────────────────────────────────────

  /**
   * Decides whether to warn that the downloaded library could be evicted.
   *
   * Browsers may clear script-writable storage when space runs low, and WebKit
   * does so after roughly a week without a visit. Installing the app is what
   * grants persistence, so the warning shows whenever the browser reports the
   * storage as not persisted — on every platform, since the risk is not iOS-only.
   * Only the remedy differs, which the template words per platform.
   */
  private async refreshInstallHint(): Promise<void> {
    if (localStorage.getItem(INSTALL_HINT_DISMISSED) === '1') return;
    if (isStandalone()) return; // already installed — nothing left to suggest
    this.showInstallHint = !(await this.storage.isStoragePersisted());
  }

  /** Which set of instructions to show; the steps differ per platform. */
  readonly installPlatform: InstallPlatform = this.isBrowser ? detectPlatform() : 'desktop';

  /**
   * True once the browser has offered a real install prompt. Chromium fires
   * beforeinstallprompt on Android and desktop, which lets us install in one tap;
   * Safari and Firefox never do, so those users get written steps instead.
   */
  canInstallDirectly = false;
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

  private readonly onBeforeInstallPrompt = (event: Event) => {
    // Preventing the default suppresses Chrome's own mini-infobar so the prompt
    // fires from our button instead, in context.
    event.preventDefault();
    this.deferredInstallPrompt = event as BeforeInstallPromptEvent;
    this.zone.run(() => { this.canInstallDirectly = true; });
  };

  private readonly onAppInstalled = () => {
    this.zone.run(() => {
      this.showInstallHint = false;
      this.canInstallDirectly = false;
      this.deferredInstallPrompt = null;
    });
    // Installing is what earns persistence, so claim it now.
    this.storage.requestPersistentStorage().catch(() => {});
  };

  async install(): Promise<void> {
    const prompt = this.deferredInstallPrompt;
    if (!prompt) return;
    this.deferredInstallPrompt = null;
    this.canInstallDirectly = false;

    await prompt.prompt();
    const {outcome} = await prompt.userChoice;
    if (outcome === 'accepted') {
      this.showInstallHint = false;
    } else {
      // Declined — leave the written steps available rather than nothing.
      this.msg.add({
        severity: 'info',
        summary: 'Not installed',
        detail: 'Your library may be cleared if storage runs low.',
        life: 4000,
      });
    }
  }

  dismissInstallHint(): void {
    this.showInstallHint = false;
    localStorage.setItem(INSTALL_HINT_DISMISSED, '1');
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) this.registerLaunchQueue();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.isBrowser) {
      window.removeEventListener('beforeinstallprompt', this.onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', this.onAppInstalled);
    }
    if (this.detailCoverBlob) URL.revokeObjectURL(this.detailCoverBlob);
  }

  // ── launchQueue ────────────────────────────────────────────────────────────

  private registerLaunchQueue(): void {
    const lq = (window as any)['launchQueue'];
    if (!lq) return;
    lq.setConsumer((params: any) => {
      const files: FileSystemFileHandle[] = params?.files ?? [];
      if (!files.length) return;
      this.zone.run(() => { this.showImport = true; });
      // The ImportZoneComponent handles the file via its own launchQueue listener.
    });
  }

  // ── Filtering & sorting ────────────────────────────────────────────────────

  applyFilters(): void {
    const filtered = this.library.filter(
      this.allEntries, this.search, this.selectedStatus, this.selectedSource,
    );
    this.displayed = this.library.sort(filtered, this.selectedSort);
  }

  clearSearch(): void { this.search = ''; this.applyFilters(); }

  // ── Import ─────────────────────────────────────────────────────────────────

  onImported(entry: LibraryEntry): void {
    this.library.pushEntry(entry);
    this.msg.add({severity: 'success', summary: 'Imported', detail: entry.title, life: 3000});
    this.refreshStorageInfo();
    // Now that the user has content worth keeping, ask the browser not to evict
    // it. Failure is expected on Safari and is handled by the install hint.
    this.storage.requestPersistentStorage()
      .then(() => this.refreshInstallHint())
      .catch(() => {});
    setTimeout(() => { this.showImport = false; }, 1200);
  }

  // ── Detail panel ───────────────────────────────────────────────────────────

  openDetail(entry: LibraryEntry): void {
    if (this.detailCoverBlob) { URL.revokeObjectURL(this.detailCoverBlob); this.detailCoverBlob = ''; }
    this.detailCoverUrl   = null;
    this.selectedEntry    = entry;
    this.showDetail       = true;
    this.detailProgress   = new Map();

    this.storage.getSeriesProgress(entry.id)
      .then(progress => { this.detailProgress = progress; })
      .catch(() => {});

    if (entry.cover) {
      this.storage.getImageUrl(entry.id, entry.cover)
        .then(url => { this.detailCoverBlob = url; this.detailCoverUrl = url; })
        .catch(() => {});
    }
  }

  /**
   * Reading state of a chapter, from the per-chapter progress records.
   *
   * LibraryEntry.lastReadChapterId only names the most recent chapter, so it
   * cannot tell "already finished" from "never opened" for everything else —
   * that distinction comes from the progress store.
   */
  chapterState(chapter: ManifestChapter): 'unread' | 'reading' | 'read' {
    const progress = this.detailProgress.get(chapter.id);
    if (!progress) return 'unread';
    return progress.page >= chapter.pages - 1 ? 'read' : 'reading';
  }

  /** How far through a chapter the user got, as a percentage (0 when unread). */
  chapterPercent(chapter: ManifestChapter): number {
    const progress = this.detailProgress.get(chapter.id);
    if (!progress || chapter.pages <= 1) return 0;
    return Math.min(100, Math.round(((progress.page + 1) / chapter.pages) * 100));
  }

  /**
   * Chapters of the open series, newest first.
   *
   * Storage keeps them ascending (the canonical reading order the reader relies
   * on for prev/next), but a chapter list reads better newest-first — that is
   * where the next unread chapter is.
   */
  get detailChapters(): ManifestChapter[] {
    if (!this.selectedEntry) return [];
    return [...this.selectedEntry.chapters].sort((a, b) => b.number - a.number);
  }

  /** Number of chapters in the open series the user has finished. */
  get readChapterCount(): number {
    if (!this.selectedEntry) return 0;
    return this.selectedEntry.chapters.filter(ch => this.chapterState(ch) === 'read').length;
  }

  openChapter(chapter: ManifestChapter): void {
    if (!this.selectedEntry) return;
    this.router.navigate(['/library/read', this.selectedEntry.id, chapter.id]);
  }

  /** The chapter to resume, when one was read and is still in the library. */
  get resumeChapter(): ManifestChapter | null {
    const id = this.selectedEntry?.lastReadChapterId;
    if (!id) return null;
    return this.selectedEntry!.chapters.find(c => c.id === id) ?? null;
  }

  /**
   * Reopens the last chapter read, scrolled back to the exact position.
   * The resume flag tells the reader to jump straight there rather than show
   * its "resume where you left off" prompt, which would be redundant here.
   */
  continueReading(): void {
    const chapter = this.resumeChapter;
    if (!chapter || !this.selectedEntry) return;
    this.router.navigate(['/library/read', this.selectedEntry.id, chapter.id], {
      queryParams: {resume: 1},
    });
  }

  /** Status tag of the open series — the same helpers the library cards use. */
  get statusSeverity(): SeriesStatusSeverity { return seriesStatusSeverity(this.selectedEntry?.status); }
  get statusLabel(): string { return seriesStatusLabel(this.selectedEntry?.status); }

  isLastRead(chapter: ManifestChapter): boolean {
    return this.selectedEntry?.lastReadChapterId === chapter.id;
  }

  // ── Chapter deletion ───────────────────────────────────────────────────────

  /** Width of the swipe-revealed delete action, in px. */
  readonly swipeActionWidth = 84;

  /** Row held open by a completed swipe. */
  swipedChapterId: string | null = null;
  private swipingId: string | null = null;
  private swipeStartX = 0;
  private swipeDx = 0;
  /** Set when a drag occurred, so the trailing click does not open the chapter. */
  private swipeMoved = false;

  /**
   * Pointer devices get the hover delete button instead of the swipe, and the
   * swipe action is hidden there by CSS. The gesture has to be disabled on the
   * same condition, otherwise dragging a row sideways would slide it away to
   * reveal an action that is not rendered.
   */
  private get swipeEnabled(): boolean {
    return this.isBrowser && !window.matchMedia('(hover: hover)').matches;
  }

  onSwipeStart(event: TouchEvent, chapterId: string): void {
    if (!this.swipeEnabled) return;
    if (this.swipedChapterId && this.swipedChapterId !== chapterId) this.swipedChapterId = null;
    this.swipeStartX = event.touches[0].clientX;
    this.swipingId   = chapterId;
    this.swipeDx     = this.swipedChapterId === chapterId ? -this.swipeActionWidth : 0;
    this.swipeMoved  = false;
  }

  onSwipeMove(event: TouchEvent, chapterId: string): void {
    if (this.swipingId !== chapterId) return;
    const base  = this.swipedChapterId === chapterId ? -this.swipeActionWidth : 0;
    const delta = event.touches[0].clientX - this.swipeStartX;
    if (Math.abs(delta) > 6) this.swipeMoved = true;
    // Leftward only, and never past the action width.
    this.swipeDx = Math.max(-this.swipeActionWidth, Math.min(0, base + delta));
  }

  onSwipeEnd(chapterId: string): void {
    if (this.swipingId !== chapterId) return;
    // Past halfway the row snaps open, otherwise it springs back.
    this.swipedChapterId = this.swipeDx < -this.swipeActionWidth / 2 ? chapterId : null;
    this.swipingId = null;
    this.swipeDx   = 0;
  }

  /** Horizontal offset of a chapter row, mid-drag or snapped open. */
  rowOffset(chapterId: string): number {
    if (this.swipingId === chapterId) return this.swipeDx;
    return this.swipedChapterId === chapterId ? -this.swipeActionWidth : 0;
  }

  /**
   * Row tap. A swipe ends in a click too, so an open or just-dragged row closes
   * instead of opening the chapter — otherwise reaching for Delete would start
   * reading instead.
   */
  onChapterClick(chapter: ManifestChapter): void {
    if (this.swipeMoved || this.swipedChapterId === chapter.id) {
      this.swipedChapterId = null;
      this.swipeMoved = false;
      return;
    }
    this.openChapter(chapter);
  }

  confirmDeleteChapter(chapter: ManifestChapter): void {
    if (!this.selectedEntry) return;
    const entry = this.selectedEntry;
    const isLast = entry.chapters.length === 1;
    this.confirm.confirm({
      header: 'Delete chapter',
      message: isLast
        ? `"${chapter.title}" is the only chapter left — deleting it removes "${entry.title}" from your library.`
        : `Delete "${chapter.title}"? Its images will be removed from this device.`,
      icon: 'pi pi-trash',
      accept: () => this.doDeleteChapter(entry, chapter),
    });
  }

  private async doDeleteChapter(entry: LibraryEntry, chapter: ManifestChapter): Promise<void> {
    this.swipedChapterId = null;
    const updated = await this.library.deleteChapter(entry.id, chapter);
    if (updated) {
      this.selectedEntry = updated;
    } else {
      this.selectedEntry = null;
      this.showDetail = false;
    }
    this.msg.add({severity: 'info', summary: 'Chapter deleted', detail: chapter.title, life: 2500});
    this.refreshStorageInfo();
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  confirmDelete(entry: LibraryEntry): void {
    this.confirm.confirm({
      message: `Remove "${entry.title}" from your library? This cannot be undone.`,
      header: 'Remove series',
      icon: 'pi pi-trash',
      accept: () => this.doDelete(entry),
    });
  }

  private async doDelete(entry: LibraryEntry): Promise<void> {
    await this.library.deleteSeries(entry.id);
    if (this.selectedEntry?.id === entry.id) this.showDetail = false;
    this.msg.add({severity: 'info', summary: 'Removed', detail: entry.title, life: 2500});
    this.refreshStorageInfo();
  }

  // ── Storage gauge ──────────────────────────────────────────────────────────

  private async refreshStorageInfo(): Promise<void> {
    const {used, quota} = await this.storage.getStorageEstimate();
    this.storage_ = {
      used,
      quota,
      percent: quota ? Math.round((used / quota) * 100) : 0,
      usedLabel:  this.formatBytes(used),
      quotaLabel: this.formatBytes(quota),
    };
  }

  formatBytes(b: number): string {
    if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
    if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
    if (b >= 1e3) return (b / 1e3).toFixed(0) + ' KB';
    return b + ' B';
  }
}

// ── Platform helpers ─────────────────────────────────────────────────────────

const INSTALL_HINT_DISMISSED = 'offtoon.installHintDismissed';

export type InstallPlatform = 'ios' | 'android' | 'desktop';

/** The Chromium-only event that lets a page trigger its own install prompt. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}

/** iPadOS reports itself as MacIntel, so touch support is the distinguishing signal. */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function detectPlatform(): InstallPlatform {
  if (isIOS()) return 'ios';
  if (/Android/.test(navigator.userAgent)) return 'android';
  return 'desktop';
}

function isStandalone(): boolean {
  return (navigator as {standalone?: boolean}).standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
}
