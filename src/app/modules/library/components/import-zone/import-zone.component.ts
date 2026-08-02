import {
  Component,
  EventEmitter,
  inject,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {ProgressBarModule} from 'primeng/progressbar';
import {DialogModule} from 'primeng/dialog';
import {Subscription} from 'rxjs';
import {ImportProgress, LibraryEntry} from '@core/models/library.model';
import {OfflineStorageService} from '@core/services/offline-storage.service';

@Component({
  selector: 'app-import-zone',
  standalone: true,
  imports: [CommonModule, ButtonModule, ProgressBarModule, DialogModule],
  templateUrl: './import-zone.component.html',
  styleUrl: './import-zone.component.scss',
})
export class ImportZoneComponent implements OnInit, OnDestroy {

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() imported = new EventEmitter<LibraryEntry>();

  private readonly storage = inject(OfflineStorageService);
  private readonly zone = inject(NgZone);

  isDragging = false;
  progress: ImportProgress | null = null;
  duplicateFile: File | null = null;
  private sub: Subscription | null = null;

  get isIdle(): boolean     { return !this.progress || this.progress.phase === 'done' || this.progress.phase === 'error'; }
  get isBusy(): boolean     { return !!this.progress && !this.isIdle; }
  get progressPercent(): number { return this.progress?.percent ?? 0; }

  ngOnInit(): void {
    this.registerLaunchQueue();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ---------------------------------------------------------------------------
  // launchQueue — file opened from OS (file_handlers in manifest)
  // ---------------------------------------------------------------------------

  private registerLaunchQueue(): void {
    const lq = (window as any)['launchQueue'];
    if (!lq) return;
    lq.setConsumer((params: any) => {
      const files: FileSystemFileHandle[] = params?.files ?? [];
      if (!files.length) return;
      files[0].getFile().then((file: File) => {
        this.zone.run(() => this.startImport(file));
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Drag & drop
  // ---------------------------------------------------------------------------

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(): void {
    this.isDragging = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) this.handleFile(file);
  }

  // ---------------------------------------------------------------------------
  // File picker
  // ---------------------------------------------------------------------------

  openFilePicker(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.offtoon,application/octet-stream';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) this.handleFile(file);
    };
    input.click();
  }

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  private handleFile(file: File): void {
    if (!file.name.endsWith('.offtoon')) {
      this.progress = {phase: 'error', error: `"${file.name}" is not a .offtoon file.`};
      return;
    }
    this.startImport(file);
  }

  startImport(file: File): void {
    this.sub?.unsubscribe();
    this.progress = {phase: 'reading'};
    this.duplicateFile = null;

    this.sub = this.storage.importOfftoon(file).subscribe({
      next: (p) => { this.progress = p; },
      complete: () => {
        if (this.progress?.phase === 'done' && this.progress.entry) {
          this.imported.emit(this.progress.entry);
        }
      },
      error: (err) => {
        this.progress = {phase: 'error', error: String(err)};
      },
    });
  }

  reset(): void {
    this.sub?.unsubscribe();
    this.progress = null;
    this.duplicateFile = null;
  }

  close(): void {
    if (this.isBusy) return;
    this.reset();
    this.visibleChange.emit(false);
  }

  // ---------------------------------------------------------------------------
  // Labels
  // ---------------------------------------------------------------------------

  get phaseLabel(): string {
    switch (this.progress?.phase) {
      case 'reading':    return 'Reading file…';
      case 'parsing':    return 'Parsing manifest…';
      case 'extracting': return `Extracting images… ${this.progressPercent}%`;
      case 'done':       return `Import complete — ${this.progress?.entry?.title ?? ''}`;
      case 'error':      return `Error: ${this.progress?.error}`;
      default:           return '';
    }
  }

  get phaseIcon(): string {
    switch (this.progress?.phase) {
      case 'done':  return 'pi pi-check-circle';
      case 'error': return 'pi pi-times-circle';
      default:      return 'pi pi-spin pi-spinner';
    }
  }
}
