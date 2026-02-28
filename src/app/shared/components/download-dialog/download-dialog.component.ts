import {Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {Subscription} from 'rxjs';
import {ToonService} from '@core/api/api/toon.service';
import {ApiSource} from '@core/api/model/apiSource';
import {ToonChapter} from '@core/api/model/toonChapter';
import {NotificationUtilsService} from '@shared/services/notification-utils.service';
import {DownloadFormat, DownloadProgress, DownloadService, WsPacketChapterReport} from '@shared/services/download.service';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {SelectButtonModule} from 'primeng/selectbutton';
import {ProgressBarModule} from 'primeng/progressbar';
import {TranslateModule} from '@ngx-translate/core';
import {FormsModule} from '@angular/forms';
import {UpperCasePipe} from '@angular/common';
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
    UpperCasePipe,
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
    // return 'downloading';
  }

  get chaptersPercent(): number {
    if (!this.progress?.chaptersTotal) return 0;
    return Math.round((this.progress.chaptersDone / this.progress.chaptersTotal) * 100);
  }

  get imagesPercent(): number {
    if (!this.progress?.imagesTotal) return 0;
    return Math.round((this.progress.imagesDone / this.progress.imagesTotal) * 100);
  }

  get selectedFormatDesc(): string {
    return this.formatOptions.find(f => f.value === this.selectedFormat)?.description ?? '';
  }

  get isClosable(): boolean {
    const s = this.state;
    return s !== 'pending' && s !== 'connecting' && s !== 'chapters' && s !== 'archiving' && s !== 'images' && s !== 'zipping' && s !== 'downloading';
  }

  get chapterReports(): WsPacketChapterReport[] {
    return this.progress?.chapterReports ?? [];
  }

  private readonly statusOrder: Record<string, number> = { failed: 0, incomplete: 1, success: 2 };

  get sortedChapterReports(): WsPacketChapterReport[] {
    return [...this.chapterReports].sort((a, b) => {
      const byStatus = (this.statusOrder[a.status] ?? 3) - (this.statusOrder[b.status] ?? 3);
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
    // return true
  }

  get reportSummary(): { success: number; incomplete: number; failed: number } {
    const reports = this.chapterReports;
    return {
      success: reports.filter(r => r.status === 'success').length,
      incomplete: reports.filter(r => r.status === 'incomplete').length,
      failed: reports.filter(r => r.status === 'failed').length,
    };
  }

  get dialogWidthClass(): string {
    return this.hasReports ? 'w-full max-w-2xl' : 'w-full max-w-lg';
  }

  reportSeverity(status: 'success' | 'incomplete' | 'failed'): 'success' | 'warn' | 'danger' {
    if (status === 'success') return 'success';
    if (status === 'incomplete') return 'warn';
    return 'danger';
  }

  reportIconClass(status: 'success' | 'incomplete' | 'failed'): string {
    if (status === 'incomplete') return 'pi pi-exclamation-triangle text-yellow-400';
    return 'pi pi-times-circle text-red-400';
  }

  /**
   * Returns "X / 3" for the three trackable steps, null for connecting/downloading/completed.
   * Shown as a small ambient label — not interactive.
   */
  get stepLabel(): string | null {
    switch (this.state) {
      case 'chapters':             return '1 / 3';
      case 'archiving':
      case 'images':               return '2 / 3';
      case 'zipping':              return '3 / 3';
      default:                     return null;
    }
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
    if (!this.isClosable) return; // guard — PrimeNG closable binding handles this too
    this.downloadService.reset();
    this.visibleChange.emit(false);
  }

  startDownload(): void {
    const chapterIds = this.chapters.map(c => c.id!).filter(Boolean);
    if (!chapterIds.length) return;

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
