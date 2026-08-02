import {Component, inject, NgZone, OnDestroy, OnInit, PLATFORM_ID} from '@angular/core';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import {ActivatedRoute, Router} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {Subscription} from 'rxjs';

import {ButtonModule} from 'primeng/button';
import {SelectModule} from 'primeng/select';

import {LibraryEntry, ManifestChapter} from '@core/models/library.model';
import {OfflineStorageService} from '@core/services/offline-storage.service';
import {LibraryDbService} from '@core/services/library-db.service';

@Component({
  selector: 'app-reader',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, SelectModule],
  templateUrl: './reader.component.html',
  styleUrl: './reader.component.scss',
})
export class ReaderComponent implements OnInit, OnDestroy {

  private readonly route     = inject(ActivatedRoute);
  private readonly router    = inject(Router);
  private readonly storage   = inject(OfflineStorageService);
  private readonly db        = inject(LibraryDbService);
  private readonly zone      = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ── State ─────────────────────────────────────────────────────────────────

  series: LibraryEntry | null = null;
  chapter: ManifestChapter | null = null;
  imageUrls: string[] = [];
  coverUrl = '';
  loading = true;
  error = '';
  currentPage = 0;
  hudVisible = true;
  showScrollTop = false;
  showResumePrompt = false;
  selectsOpen = 0;
  /** Bound to the PrimeNG Select — kept in sync with the current chapter. */
  selectedChapterId = '';

  // ── Internals ──────────────────────────────────────────────────────────────

  private routeSub: Subscription | null = null;
  private revokeList: string[] = [];
  private coverBlobUrl = '';
  private observer: IntersectionObserver | null = null;
  private footerObserver: IntersectionObserver | null = null;
  private hudTimer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  resumePage = 0;
  private resumeScrollTop = 0;
  /** Set when the reader was opened via "Continue reading" — skips the prompt. */
  private autoResume = false;
  /** True once the reader has scrolled by hand, which cancels resume correction. */
  private userScrolled = false;
  private userIntentListener: (() => void) | null = null;
  private scrollEl: HTMLElement | null = null;
  private scrollListener: (() => void) | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      // ?resume=1 is set by "Continue reading" in the library.
      this.autoResume = this.route.snapshot.queryParamMap.get('resume') === '1';
      this.loadChapter(
        params.get('seriesId') ?? '',
        params.get('chapterId') ?? '',
      );
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.revokeAll();
    this.observer?.disconnect();
    this.footerObserver?.disconnect();
    this.clearHudTimer();
    this.detachScrollListener();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this.coverBlobUrl) URL.revokeObjectURL(this.coverBlobUrl);
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  private async loadChapter(seriesId: string, chapterId: string): Promise<void> {
    if (!this.isBrowser) return;

    this.loading = true;
    this.error   = '';
    this.showScrollTop = false;
    this.revokeAll();
    this.observer?.disconnect();
    this.detachScrollListener();

    try {
      const series = await this.storage.getSeries(seriesId);
      if (!series) throw new Error('Series not found in library');
      this.series = series;

      const ch = series.chapters.find(c => c.id === chapterId);
      if (!ch) throw new Error('Chapter not found');
      this.chapter = ch;
      this.selectedChapterId = ch.id;

      const [saved, urls] = await Promise.all([
        this.db.getProgress(seriesId, chapterId),
        this.storage.getChapterImageUrls(seriesId, ch.path, ch.pages),
      ]);

      this.revokeList  = [...urls];
      this.imageUrls   = urls;
      this.resumePage       = Math.min(saved?.page ?? 0, Math.max(0, urls.length - 1));
      this.resumeScrollTop  = saved?.scrollTop ?? 0;
      this.currentPage      = 0;
      this.loading     = false;

      // Load cover asynchronously — non-blocking
      if (series.cover) {
        this.storage.getImageUrl(seriesId, series.cover)
          .then(url => {
            if (this.coverBlobUrl) URL.revokeObjectURL(this.coverBlobUrl);
            this.coverBlobUrl = url;
            this.coverUrl = url;
          })
          .catch(() => {});
      }

      setTimeout(() => {
        this.setupObserver();
        this.attachScrollListener();
        this.setupFooterObserver();
        this.hudVisible = false;

        // Arriving via "Continue reading" means the user already asked to resume,
        // so jump straight there instead of offering the prompt again.
        if (this.autoResume && this.resumeScrollTop > 0) {
          this.scrollToSaved(true);
        } else {
          this.showResumePrompt = this.resumePage > 0;
        }
        this.autoResume = false;
      }, 80);

    } catch (e: any) {
      this.error   = e?.message ?? 'Failed to load chapter';
      this.loading = false;
    }
  }

  // ── Scroll listener ────────────────────────────────────────────────────────

  private attachScrollListener(): void {
    this.scrollEl = document.querySelector<HTMLElement>('.reader-scroll');
    if (!this.scrollEl) return;
    this.scrollListener = () => {
      if (this.hudVisible) this.zone.run(() => { this.hudVisible = false; });
      if (this.showResumePrompt) this.zone.run(() => { this.showResumePrompt = false; });
    };
    this.scrollEl.addEventListener('scroll', this.scrollListener, { passive: true });

    // The scroll event cannot tell a programmatic jump from a real one, so user
    // intent is read from the input events instead. This stops the resume
    // correction from yanking the page back if the reader starts scrolling.
    this.userIntentListener = () => { this.userScrolled = true; };
    for (const type of ['wheel', 'touchstart', 'keydown'] as const) {
      this.scrollEl.addEventListener(type, this.userIntentListener, { passive: true });
    }
  }

  private setupFooterObserver(): void {
    this.footerObserver?.disconnect();
    const footer = document.querySelector<HTMLElement>('.reader-footer');
    if (!footer) return;
    this.footerObserver = new IntersectionObserver(entries => {
      const visible = entries.some(e => e.isIntersecting);
      if (visible !== this.showScrollTop) {
        this.zone.run(() => { this.showScrollTop = visible; });
      }
    }, { threshold: 0.05 });
    this.footerObserver.observe(footer);
  }

  private detachScrollListener(): void {
    if (this.scrollEl && this.scrollListener) {
      this.scrollEl.removeEventListener('scroll', this.scrollListener);
    }
    if (this.scrollEl && this.userIntentListener) {
      for (const type of ['wheel', 'touchstart', 'keydown'] as const) {
        this.scrollEl.removeEventListener(type, this.userIntentListener);
      }
    }
    this.footerObserver?.disconnect();
    this.footerObserver = null;
    this.scrollEl = null;
    this.scrollListener = null;
    this.userIntentListener = null;
    this.userScrolled = false;
  }

  scrollToTop(): void {
    // Query fresh each time — this.scrollEl can be stale after chapter transitions
    document.querySelector<HTMLElement>('.reader-scroll')
      ?.scrollTo({top: 0, behavior: 'smooth'});
  }

  // ── IntersectionObserver ───────────────────────────────────────────────────

  private setupObserver(): void {
    this.observer?.disconnect();
    const pages = document.querySelectorAll<HTMLElement>('.reader-page');
    if (!pages.length) return;

    this.observer = new IntersectionObserver(entries => {
      let bestPage = -1;
      let bestScore = -Infinity;

      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const score = e.intersectionRatio - Math.abs(e.boundingClientRect.top) * 0.0001;
        if (score > bestScore) {
          bestScore = score;
          bestPage  = parseInt((e.target as HTMLElement).dataset['page'] ?? '-1', 10);
        }
      });

      if (bestPage >= 0 && bestPage !== this.currentPage) {
        this.zone.run(() => {
          this.currentPage = bestPage;
          this.scheduleSave();
        });
      }
    }, {threshold: [0, 0.1, 0.5, 0.9, 1.0]});

    pages.forEach(el => this.observer!.observe(el));
  }

  private scrollToPage(page: number, behavior: ScrollBehavior = 'smooth'): void {
    const el = document.querySelector<HTMLElement>(`.reader-page[data-page="${page}"]`);
    if (el) el.scrollIntoView({behavior, block: 'start'});
  }

  // ── Progress ────────────────────────────────────────────────────────────────

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (!this.series || !this.chapter) return;
      this.db.saveProgress({
        seriesId:  this.series.id,
        chapterId: this.chapter.id,
        page:      this.currentPage,
        scrollTop: document.querySelector<HTMLElement>('.reader-scroll')?.scrollTop ?? 0,
        savedAt:   new Date().toISOString(),
      }).catch(() => {});
    }, 800);
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  showHudBriefly(ms = 2000): void {
    this.hudVisible = true;
    this.clearHudTimer();
    this.hudTimer = setTimeout(() => {
      this.zone.run(() => { this.hudVisible = false; });
    }, ms);
  }

  onActivity(): void {
    this.zone.run(() => { this.showHudBriefly(); });
  }

  toggleHud(): void {
    if (this.selectsOpen > 0) return;
    this.hudVisible = !this.hudVisible;
  }

  onSelectShow(): void { this.selectsOpen++; }
  onSelectHide(): void { this.selectsOpen = Math.max(0, this.selectsOpen - 1); }

  /**
   * Returns to the exact saved position.
   *
   * Pages load lazily, so images above the target settle their height after the
   * jump and the browser's scroll anchoring shifts the viewport to compensate —
   * measured as landing ~200px past a saved 400px. The position is therefore
   * re-asserted a couple of times while the layout settles. Instant scrolling is
   * used when resuming automatically, since a smooth animation racing those
   * reflows is what makes the drift visible in the first place.
   */
  scrollToSaved(instant = false): void {
    this.showResumePrompt = false;
    const el = document.querySelector<HTMLElement>('.reader-scroll');
    if (!el) return;

    const top = this.resumeScrollTop;
    el.scrollTo({top, behavior: instant ? 'auto' : 'smooth'});
    if (!instant) return;

    for (const delay of [150, 400, 800]) {
      setTimeout(() => {
        // Give up if the reader moved on, or the user already scrolled away.
        if (Math.abs(el.scrollTop - top) > 4 && !this.userScrolled) {
          el.scrollTo({top, behavior: 'auto'});
        }
      }, delay);
    }
  }

  dismissResume(): void { this.showResumePrompt = false; }

  private clearHudTimer(): void {
    if (this.hudTimer !== null) { clearTimeout(this.hudTimer); this.hudTimer = null; }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  goBack(): void { this.router.navigate(['/library']); }

  /**
   * Chapters ascending by number — the canonical reading order.
   * Drives prev/next and the position label, so it must stay ascending even
   * though the pickers list chapters the other way round.
   */
  get sortedChapters(): ManifestChapter[] {
    if (!this.series) return [];
    return [...this.series.chapters].sort((a, b) => a.number - b.number);
  }

  /** Chapters newest-first, matching how sources list them in a dropdown. */
  get chapterOptions(): ManifestChapter[] {
    return [...this.sortedChapters].reverse();
  }

  private get readingIndex(): number {
    if (!this.chapter) return -1;
    return this.sortedChapters.findIndex(c => c.id === this.chapter!.id);
  }

  get prevChapter(): ManifestChapter | null {
    const i = this.readingIndex;
    return i > 0 ? this.sortedChapters[i - 1] : null;
  }

  get nextChapter(): ManifestChapter | null {
    const i = this.readingIndex;
    const sorted = this.sortedChapters;
    return (i >= 0 && i < sorted.length - 1) ? sorted[i + 1] : null;
  }

  get isLastChapter(): boolean {
    return !this.nextChapter;
  }

  get chapterPosition(): string {
    const i = this.readingIndex;
    const total = this.sortedChapters.length;
    return i >= 0 ? `${i + 1} / ${total}` : '';
  }

  navigateChapter(ch: ManifestChapter): void {
    if (!this.series) return;
    this.router.navigate(['/library/read', this.series.id, ch.id]);
  }

  onChapterSelectChange(chapterId: string): void {
    const ch = this.series?.chapters.find(c => c.id === chapterId);
    if (ch && ch.id !== this.chapter?.id) this.navigateChapter(ch);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  private revokeAll(): void {
    this.revokeList.forEach(u => URL.revokeObjectURL(u));
    this.revokeList = [];
    this.imageUrls  = [];
  }

  trackByIdx = (i: number): number => i;
}
