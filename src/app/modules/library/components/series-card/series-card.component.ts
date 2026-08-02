import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TagModule} from 'primeng/tag';
import {ButtonModule} from 'primeng/button';
import {SkeletonModule} from 'primeng/skeleton';
import {TooltipModule} from 'primeng/tooltip';
import {LibraryEntry} from '@core/models/library.model';
import {OfflineStorageService} from '@core/services/offline-storage.service';
import {SeriesStatusSeverity, seriesStatusLabel, seriesStatusSeverity} from '../../services/library.service';

@Component({
  selector: 'app-series-card',
  standalone: true,
  imports: [CommonModule, TagModule, ButtonModule, SkeletonModule, TooltipModule],
  templateUrl: './series-card.component.html',
  styleUrl: './series-card.component.scss',
})
export class SeriesCardComponent implements OnInit, OnDestroy {

  @Input({required: true}) entry!: LibraryEntry;
  @Output() open   = new EventEmitter<LibraryEntry>();
  @Output() delete = new EventEmitter<LibraryEntry>();

  private readonly storage = inject(OfflineStorageService);

  coverUrl: string | null = null;
  coverLoading = true;
  private blobUrl: string | null = null;

  ngOnInit(): void {
    if (this.entry.cover) {
      this.storage.getImageUrl(this.entry.id, this.entry.cover)
        .then(url => { this.blobUrl = url; this.coverUrl = url; this.coverLoading = false; })
        .catch(() => { this.coverLoading = false; });
    } else {
      this.coverLoading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
  }

  get statusSeverity(): SeriesStatusSeverity { return seriesStatusSeverity(this.entry.status); }

  get statusLabel(): string { return seriesStatusLabel(this.entry.status); }

  get isRead(): boolean { return !!this.entry.lastReadChapterId; }

  get readLabel(): string {
    if (!this.entry.lastReadChapterId) return '';
    const ch = this.entry.chapters.find(c => c.id === this.entry.lastReadChapterId);
    return ch ? ch.title : '';
  }

  get successChapters(): number {
    return this.entry.chapters.filter(c => c.status !== 'failed').length;
  }

  onCardClick(): void { this.open.emit(this.entry); }

  onDelete(e: Event): void {
    e.stopPropagation();
    this.delete.emit(this.entry);
  }
}
