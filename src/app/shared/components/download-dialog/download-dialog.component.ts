import {Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {Subscription} from 'rxjs';
import {ToonService} from '@core/api/api/toon.service';
import {ApiSource} from '@core/api/model/apiSource';
import {ToonChapter} from '@core/api/model/toonChapter';
import {NotificationUtilsService} from '@shared/services/notification-utils.service';
import {DownloadFormat, DownloadProgress, DownloadService, WsPacketChapterReport} from '@shared/services/download.service';
import {AnalyticsService} from '@core/services/analytics.service';
import {ArchiverChapterStatus} from '@core/api/model/archiverChapterStatus';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {SelectButtonModule} from 'primeng/selectbutton';
import {ProgressBarModule} from 'primeng/progressbar';
import {TranslateModule} from '@ngx-translate/core';
import {FormsModule} from '@angular/forms';
import {AccordionModule} from 'primeng/accordion';
import {TagModule} from 'primeng/tag';
import {TooltipModule} from 'primeng/tooltip';

interface FormatOption {
  label: string;
  value: DownloadFormat;
  description: string;
}

@Component({
  selector: 'app-download-dialog',
  imports: [
    DialogModule,
    ButtonModule,
    SelectButtonModule,
    ProgressBarModule,
    TranslateModule,
    FormsModule,
    AccordionModule,
    TagModule,
    TooltipModule,
  ],
  templateUrl: './download-dialog.component.html',
  styleUrl: './download-dialog.component.scss',
})
export class DownloadDialogComponent implements OnInit, OnDestroy {
  @Input() visible = false;
  @Input() source!: ApiSource;
  @Input() slug!: string;
  @Input() chapters: ToonChapter[] = [];

  @Output() visibleChange = new EventEmitter<boolean>();

  private downloadService = inject(DownloadService);
  private toonService = inject(ToonService);
  private notificationUtils = inject(NotificationUtilsService);
  private analytics = inject(AnalyticsService);

  private sub: Subscription | null = null;

  progress: DownloadProgress | null = null;

  selectedFormat: DownloadFormat = 'pdf';

  formatOptions: FormatOption[] = [
    {label: 'PDF', value: 'pdf', description: 'download.format.pdf-desc'},
    {label: 'CBZ', value: 'cbz', description: 'download.format.cbz-desc'},
    {label: 'Images', value: 'images', description: 'download.format.images-desc'},
  ];

  get state() {
    return this.progress?.state ?? 'idle';
  }

  get percent(): number {
    if (!this.progress?.total) return 0;
    return Math.round((this.progress.done / this.progress.total) * 100);
  }

  /** Current page-level phase: 'downloading' images, then 'building' the archive. */
  get phase(): 'downloading' | 'building' {
    return this.progress?.phase ?? 'downloading';
  }

  /** True once the archive-building phase has started (the slow, CPU-bound step). */
  get isBuilding(): boolean {
    return this.state === 'downloading' && this.phase === 'building';
  }

  get selectedFormatDesc(): string {
    return this.formatOptions.find(f => f.value === this.selectedFormat)?.description ?? '';
  }

  get isClosable(): boolean {
    const s = this.state;
    return s !== 'pending' && s !== 'connecting' && s !== 'downloading' && s !== 'zipping' && s !== 'saving';
  }

  get chapterReports(): WsPacketChapterReport[] {
    return this.progress?.chapterReports ?? [];
  }

  private readonly statusOrder: Record<string, number> = {
    [ArchiverChapterStatus.ChapterStatusFailed]: 0,
    [ArchiverChapterStatus.ChapterStatusIncomplete]: 1,
    [ArchiverChapterStatus.ChapterStatusSuccess]: 2,
  };

  get sortedChapterReports(): WsPacketChapterReport[] {
    return [...this.chapterReports].sort((a, b) => {
      const byStatus = (this.statusOrder[a.status ?? ''] ?? 3) - (this.statusOrder[b.status ?? ''] ?? 3);
      if (byStatus !== 0) return byStatus;
      return (a.chapter ?? '').localeCompare(b.chapter ?? '');
    });
  }

  showReports = false;

  toggleReports(): void {
    this.showReports = !this.showReports;
  }

  get hasReports(): boolean {
    return this.chapterReports.length > 0;
  }

  get reportSummary(): { success: number; incomplete: number; failed: number } {
    const reports = this.chapterReports;
    return {
      success: reports.filter(r => r.status === ArchiverChapterStatus.ChapterStatusSuccess).length,
      incomplete: reports.filter(r => r.status === ArchiverChapterStatus.ChapterStatusIncomplete).length,
      failed: reports.filter(r => r.status === ArchiverChapterStatus.ChapterStatusFailed).length,
    };
  }

  get dialogWidthClass(): string {
    return this.hasReports ? 'w-full max-w-2xl' : 'w-full max-w-lg';
  }

  reportSeverity(status: ArchiverChapterStatus | undefined): 'success' | 'warn' | 'danger' {
    if (status === ArchiverChapterStatus.ChapterStatusSuccess) return 'success';
    if (status === ArchiverChapterStatus.ChapterStatusIncomplete) return 'warn';
    return 'danger';
  }

  reportIconClass(status: ArchiverChapterStatus | undefined): string {
    if (status === ArchiverChapterStatus.ChapterStatusIncomplete) return 'pi pi-exclamation-triangle text-yellow-400';
    return 'pi pi-times-circle text-red-400';
  }

  ngOnInit(): void {
    this.sub = this.downloadService.progress.subscribe(p => {
      this.progress = p;
      // Auto-collapse report list whenever a new session starts
      if (p.state === 'idle') this.showReports = false;
    });
    this.downloadService.reset();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onHide(): void {
    if (!this.isClosable) return; // guard - PrimeNG closable binding handles this too
    this.downloadService.reset();
    this.visibleChange.emit(false);
  }

  startDownload(): void {
    const chapterIds = this.chapters.map(c => c.id!).filter(Boolean);
    if (!chapterIds.length) return;

    this.analytics.track('download-start', {
      source: this.source,
      chapters: chapterIds.length,
      format: this.selectedFormat,
    });

    // Reset immediately so stale progress from a previous run is cleared
    // before the POST response arrives and connectAndTrack() is called.
    this.downloadService.reset();

    this.toonService.apiV1DownloadPost({
      source: this.source,
      slug: this.slug,
      chapter_ids: chapterIds,
      format: this.selectedFormat,
    }).subscribe({
      next: (res) => {
        const runtimeId = res.runtime_id;
        if (!runtimeId) {
          this.notificationUtils.showToastError('Download failed: no runtime ID received.');
          return;
        }
        this.downloadService.connectAndTrack(runtimeId, this.slug);
      },
      error: (err) => {
        this.notificationUtils.showToastError('Failed to start download', err);
      },
    });
  }

  retry(): void {
    this.downloadService.reset();
  }
}
