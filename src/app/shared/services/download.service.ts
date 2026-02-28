import {Injectable, OnDestroy} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {environment} from '@environments/environment';

export type DownloadFormat = 'pdf' | 'cbz' | 'images';

export type DownloadState =
  | 'idle'
  | 'pending'
  | 'connecting'
  | 'chapters'
  | 'archiving'
  | 'images'
  | 'zipping'
  | 'downloading'
  | 'completed'
  | 'error';

// ── Packet types ──────────────────────────────────────────────────────────────

export interface WsChapterItem {
  id: string;
  title: string;
  number: number;
  url: string;
  pages: Array<{ number: number; image_url: string }>;
}

export interface WsPacketInit {
  type: 'init';
  hash: string;
}

export interface WsPacketProgress {
  type: 'progress';
  hash: string;
  phase: 'chapters' | 'images';
  total: number;
  done: number;
  items: WsChapterItem[];
}

export interface WsPacketCompleted {
  type: 'completed';
  hash: string;
  total: number;
  archive_url: string;
}

export interface WsPacketFatal {
  type: 'fatal';
  hash: string;
  step: 1 | 2 | 3 | 4 | 5;
  message: string;
}

export interface WsPacketArchiving {
  type: 'archiving';
  hash: string;
  chapters: number;
  format: string;
}

export interface WsPacketZipping {
  type: 'zipping';
  hash: string;
  chapters: number;
  format: string;
}

export type WsPacket =
  | WsPacketInit
  | WsPacketProgress
  | WsPacketCompleted
  | WsPacketFatal
  | WsPacketArchiving
  | WsPacketZipping;

// ── Progress model ────────────────────────────────────────────────────────────

export interface DownloadProgress {
  state: DownloadState;
  /** Chapter scraping phase counters */
  chaptersDone: number;
  chaptersTotal: number;
  /** Image download phase counters */
  imagesDone: number;
  imagesTotal: number;
  /** Accumulated chapter metadata received so far */
  scrapedChapters: WsChapterItem[];
  /** Archiving phase info */
  archivingChapters: number | null;
  archivingFormat: string | null;
  /** Fatal error info */
  fatalStep: number | null;
  fatalMessage: string | null;
  /** User-friendly error text */
  errorMessage: string | null;
}

@Injectable({providedIn: 'root'})
export class DownloadService implements OnDestroy {
  private ws: WebSocket | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private retryHandle: ReturnType<typeof setTimeout> | null = null;
  private progress$ = new Subject<DownloadProgress>();

  readonly progress: Observable<DownloadProgress> = this.progress$.asObservable();

  private currentProgress: DownloadProgress = this.defaultProgress();

  private slug = '';

  /**
   * The backend can send `zipping` before the last `progress/images` packets
   * have arrived (they are sent concurrently). Buffer it here and apply it only
   * once images are fully done (done === total).
   */
  private pendingZipping: WsPacketZipping | null = null;

  private defaultProgress(): DownloadProgress {
    return {
      state: 'idle',
      chaptersDone: 0,
      chaptersTotal: 0,
      imagesDone: 0,
      imagesTotal: 0,
      scrapedChapters: [],
      archivingChapters: null,
      archivingFormat: null,
      fatalStep: null,
      fatalMessage: null,
      errorMessage: null,
    };
  }

  reset(): void {
    console.log(`[DownloadService] reset()`);
    this.clearRetry();
    this.closeWs();
    this.pendingZipping = null;
    this.currentProgress = this.defaultProgress();
    this.progress$.next({...this.currentProgress});
  }

  connectAndTrack(runtimeId: string, slug: string): void {
    console.log(`[DownloadService] connectAndTrack() — runtimeId=${runtimeId}`);
    this.slug = slug;
    this.closeWs();
    this.pendingZipping = null;

    this.currentProgress = {
      ...this.defaultProgress(),
      state: 'pending',
    };
    this.emit();

    this.openWs(runtimeId, 0);
  }

  private readonly MAX_RETRIES = 5;
  private readonly RETRY_BASE_MS = 800;
  /** 5-minute inactivity timeout — reset on every message */
  private readonly INACTIVITY_MS = 5 * 60 * 1000;

  private openWs(runtimeId: string, attempt: number): void {
    const wsUrl = `${environment.wsUrl}/api/v1/download/${runtimeId}/ws`;
    console.log(`[DownloadService] Opening WebSocket (attempt ${attempt + 1}/${this.MAX_RETRIES + 1}): ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    this.resetTimeout();

    ws.onopen = () => {
      console.log(`[DownloadService] WebSocket connected`);
    };

    ws.onmessage = (event) => {
      this.resetTimeout();
      try {
        const packet: WsPacket = JSON.parse(event.data);
        console.log(`[DownloadService] Packet (type=${packet.type}):`, packet);
        this.handlePacket(packet);
      } catch (err) {
        console.warn(`[DownloadService] Failed to parse packet:`, event.data, err);
      }
    };

    ws.onerror = (err) => {
      console.error(`[DownloadService] WebSocket error:`, err);
    };

    ws.onclose = (evt) => {
      this.clearTimeout();
      console.log(`[DownloadService] WebSocket closed (code=${evt.code}, reason="${evt.reason}", wasClean=${evt.wasClean})`);
      if (this.ws !== ws) {
        console.log(`[DownloadService] Stale socket close — ignoring`);
        return;
      }

      const s = this.currentProgress.state;
      if (s === 'completed' || s === 'error') return;

      // Retry only if we haven't received any data yet
      if (s === 'pending' && attempt < this.MAX_RETRIES) {
        const delay = this.RETRY_BASE_MS * Math.pow(2, attempt);
        console.log(`[DownloadService] Scheduling retry in ${delay}ms`);
        this.ws = null;
        this.retryHandle = setTimeout(() => {
          this.retryHandle = null;
          if (this.currentProgress.state === 'pending') {
            this.openWs(runtimeId, attempt + 1);
          }
        }, delay);
      } else {
        this.setError(null, null, 'Connection closed unexpectedly.');
      }
    };
  }

  private handlePacket(packet: WsPacket): void {
    switch (packet.type) {
      case 'init':
        console.log(`[DownloadService] ← init | WS handshake accepted — transitioning to "connecting"`);
        this.pendingZipping = null;
        this.currentProgress = {
          ...this.currentProgress,
          state: 'connecting',
          // Guarantee a clean slate for every new session in case connectAndTrack
          // was not called (e.g. reuse after partial reset) or a race left stale data.
          scrapedChapters: [],
          chaptersDone: 0,
          chaptersTotal: 0,
          imagesDone: 0,
          imagesTotal: 0,
          archivingChapters: null,
          archivingFormat: null,
          fatalStep: null,
          fatalMessage: null,
          errorMessage: null,
        };
        this.emit();
        break;

      case 'progress':
        if (packet.phase === 'chapters') {
          const accumulated = [...this.currentProgress.scrapedChapters, ...packet.items];
          console.log(
            `[DownloadService] ← progress/chapters | done=${packet.done}/${packet.total}` +
            ` batch=${packet.items.length} total_scraped=${accumulated.length}`
          );
          this.currentProgress = {
            ...this.currentProgress,
            state: 'chapters',
            chaptersDone: packet.done,
            chaptersTotal: packet.total,
            scrapedChapters: accumulated,
          };
        } else {
          const pct = Math.round((packet.done / packet.total) * 100);
          const allImagesDone = packet.done >= packet.total;
          console.log(
            `[DownloadService] ← progress/images | done=${packet.done}/${packet.total} (${pct}%)` +
            (this.pendingZipping && !allImagesDone ? ' [zipping buffered]' : '') +
            (allImagesDone && this.pendingZipping ? ' → flushing buffered zipping' : '')
          );
          this.currentProgress = {
            ...this.currentProgress,
            state: 'images',
            imagesDone: packet.done,
            imagesTotal: packet.total,
          };
          // If zipping arrived early and all images are now done, apply it now.
          if (allImagesDone && this.pendingZipping) {
            const z = this.pendingZipping;
            this.pendingZipping = null;
            this.emit(); // emit the final images state first
            this.currentProgress = {
              ...this.currentProgress,
              state: 'zipping',
              archivingChapters: z.chapters,
              archivingFormat: z.format,
            };
          }
        }
        this.emit();
        break;

      case 'completed':
        console.log(`[DownloadService] ← completed | total=${packet.total} archive_url=${packet.archive_url}`);
        this.currentProgress = {
          ...this.currentProgress,
          state: 'downloading',
        };
        this.emit();
        this.downloadArchive(packet.archive_url);
        break;

      case 'fatal':
        console.error(`[DownloadService] ← fatal | step=${packet.step} message="${packet.message}"`);
        this.closeWs();
        this.currentProgress = {
          ...this.currentProgress,
          state: 'error',
          fatalStep: packet.step,
          fatalMessage: packet.message,
          errorMessage: this.fatalStepToMessage(packet.step),
        };
        this.emit();
        break;

      case 'archiving':
        console.log(`[DownloadService] ← archiving | chapters=${packet.chapters} format=${packet.format} — image fetch + ${packet.format.toUpperCase()} build starting`);
        this.currentProgress = {
          ...this.currentProgress,
          state: 'archiving',
          archivingChapters: packet.chapters,
          archivingFormat: packet.format,
        };
        this.emit();
        break;

      case 'zipping': {
        const imagesDone = this.currentProgress.imagesDone >= this.currentProgress.imagesTotal
          && this.currentProgress.imagesTotal > 0;
        if (imagesDone) {
          console.log(`[DownloadService] ← zipping | chapters=${packet.chapters} format=${packet.format} — writing outer ZIP (may be silent for ~2 min on large archives)`);
          this.currentProgress = {
            ...this.currentProgress,
            state: 'zipping',
            archivingChapters: packet.chapters,
            archivingFormat: packet.format,
          };
          this.emit();
        } else {
          console.log(`[DownloadService] ← zipping | chapters=${packet.chapters} format=${packet.format} — buffering (images still in flight: ${this.currentProgress.imagesDone}/${this.currentProgress.imagesTotal})`);
          this.pendingZipping = packet;
          // Do not emit — UI stays in 'images' state until the last image packet arrives.
        }
        break;
      }
    }
  }

  private async downloadArchive(archiveUrl: string): Promise<void> {
    const url = archiveUrl.startsWith('http')
      ? archiveUrl
      : `${environment.apiUrl}${archiveUrl}`;
    console.log(`[DownloadService] Fetching archive blob — GET ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.closeWs();
        this.setError(null, null, `Archive download failed: ${response.status}`);
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${this.slug || 'chapters'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      console.log(`[DownloadService] Archive offered to browser (${(blob.size / 1024 / 1024).toFixed(2)} MB) — closing WS`);
      this.closeWs();
      this.currentProgress = {
        ...this.currentProgress,
        state: 'completed',
      };
      this.emit();
    } catch (err: any) {
      console.error(`[DownloadService] Archive fetch error:`, err);
      this.closeWs();
      this.setError(null, null, err?.message ?? 'Failed to download archive.');
    }
  }

  private fatalStepToMessage(step: number): string {
    switch (step) {
      case 1: return 'Failed to find the toon on the source site.';
      case 2: return 'Failed to fetch toon metadata.';
      case 3: return 'Failed to retrieve chapter page list.';
      case 4: return 'Failed to download chapter images — the CDN may be unreachable.';
      default: return 'An unexpected server error occurred.';
    }
  }

  private setError(fatalStep: number | null, fatalMessage: string | null, errorMessage: string): void {
    console.error(`[DownloadService] setError: ${errorMessage}`);
    this.closeWs();
    this.currentProgress = {
      ...this.currentProgress,
      state: 'error',
      fatalStep,
      fatalMessage,
      errorMessage,
    };
    this.emit();
  }

  private emit(): void {
    this.progress$.next({...this.currentProgress});
  }

  private closeWs(): void {
    this.clearTimeout();
    this.clearRetry();
    if (this.ws) {
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private resetTimeout(): void {
    this.clearTimeout();
    this.timeoutHandle = setTimeout(() => {
      this.setError(null, null, 'Connection timed out (no activity for 5 minutes).');
    }, this.INACTIVITY_MS);
  }

  private clearTimeout(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  private clearRetry(): void {
    if (this.retryHandle !== null) {
      clearTimeout(this.retryHandle);
      this.retryHandle = null;
    }
  }

  ngOnDestroy(): void {
    this.clearRetry();
    this.closeWs();
    this.progress$.complete();
  }
}



