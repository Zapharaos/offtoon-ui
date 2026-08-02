import {Injectable, OnDestroy} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {environment} from '@environments/environment';
import {ToonruntimePacketChapterReport} from '@core/api/model/toonruntimePacketChapterReport';
import {ToonruntimePacketCompleted} from '@core/api/model/toonruntimePacketCompleted';
import {ToonruntimePacketProgress} from '@core/api/model/toonruntimePacketProgress';
import {ToonruntimePacketInit} from '@core/api/model/toonruntimePacketInit';
import {ToonruntimePacketFatal} from '@core/api/model/toonruntimePacketFatal';
import {ToonruntimePacketArchiving} from '@core/api/model/toonruntimePacketArchiving';
import {ToonruntimePacketZipping} from '@core/api/model/toonruntimePacketZipping';
import {ToonChapter} from '@core/api/model/toonChapter';

export type {ToonruntimePacketChapterReport};
export type {ArchiverImageReport} from '@core/api/model/archiverImageReport';
export type {ToonChapter};

export type DownloadFormat = 'pdf' | 'cbz' | 'images' | 'offtoon';

export type DownloadState =
  | 'idle'
  | 'pending'
  | 'connecting'
  | 'downloading' // unified pipelined phase: page-list resolution + image download, tracked by chapters
  | 'zipping'     // writing the final outer ZIP
  | 'saving'      // fetching the assembled archive blob to the browser
  | 'completed'
  | 'error';

// ── Packet types ──────────────────────────────────────────────────────────────

// Each generated model type has `type?: ToonruntimePacketType` (optional), so the
// switch discriminant would not narrow correctly. We intersect each with a required
// literal `type` field so TypeScript can narrow the union inside handlePacket().

export type WsPacketInit        = ToonruntimePacketInit        & { type: 'init' };
export type DownloadPhase = 'downloading' | 'building';

export type WsPacketProgress    = ToonruntimePacketProgress    & { type: 'progress'; phase: DownloadPhase; done: number; total: number; items: ToonChapter[] };
export type WsPacketCompleted   = ToonruntimePacketCompleted   & { type: 'completed'; archive_url: string };
export type WsPacketFatal       = ToonruntimePacketFatal       & { type: 'fatal' };
export type WsPacketArchiving   = ToonruntimePacketArchiving   & { type: 'archiving' };
export type WsPacketZipping     = ToonruntimePacketZipping     & { type: 'zipping' };
export type WsPacketChapterReport = ToonruntimePacketChapterReport & { type: 'chapter_report' };

export type WsPacket =
  | WsPacketInit
  | WsPacketProgress
  | WsPacketCompleted
  | WsPacketFatal
  | WsPacketArchiving
  | WsPacketZipping
  | WsPacketChapterReport;

// ── Progress model ────────────────────────────────────────────────────────────

export interface DownloadProgress {
  state: DownloadState;
  /** Which page-level phase the progress counters refer to */
  phase: DownloadPhase;
  /** Page-level progress within the current phase: pages processed / total pages */
  done: number;
  total: number;
  /** Zipping phase info (format is shown while zipping) */
  archivingChapters: number | null;
  archivingFormat: string | null;
  /** Per-chapter build reports, streamed as each chapter finishes */
  chapterReports: WsPacketChapterReport[];
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

  private defaultProgress(): DownloadProgress {
    return {
      state: 'idle',
      phase: 'downloading',
      done: 0,
      total: 0,
      archivingChapters: null,
      archivingFormat: null,
      chapterReports: [],
      fatalStep: null,
      fatalMessage: null,
      errorMessage: null,
    };
  }

  reset(): void {
    console.log(`[DownloadService] reset()`);
    this.clearRetry();
    this.closeWs();
    this.currentProgress = this.defaultProgress();
    this.progress$.next({...this.currentProgress});
  }

  connectAndTrack(runtimeId: string, slug: string): void {
    console.log(`[DownloadService] connectAndTrack() - runtimeId=${runtimeId}`);
    this.slug = slug;
    this.closeWs();

    this.currentProgress = {
      ...this.defaultProgress(),
      state: 'pending',
    };
    this.emit();

    this.openWs(runtimeId, 0);
  }

  private readonly MAX_RETRIES = 5;
  private readonly RETRY_BASE_MS = 800;
  /** 5-minute inactivity timeout - reset on every message */
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
        console.log(`[DownloadService] Stale socket close - ignoring`);
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
        console.log(`[DownloadService] ← init | WS handshake accepted - transitioning to "connecting"`);
        this.currentProgress = {
          ...this.currentProgress,
          state: 'connecting',
          // Guarantee a clean slate for every new session in case connectAndTrack
          // was not called (e.g. reuse after partial reset) or a race left stale data.
          phase: 'downloading',
          done: 0,
          total: 0,
          archivingChapters: null,
          archivingFormat: null,
          chapterReports: [],
          fatalStep: null,
          fatalMessage: null,
          errorMessage: null,
        };
        this.emit();
        break;

      case 'progress': {
        // Two pipelined page-level phases: 'downloading' then 'building'. Total is
        // shared across both, so always refresh it. Once 'building' has started,
        // ignore late 'downloading' packets for phase/done so the view doesn't
        // flip back - but still keep the total current (more chapters may resolve).
        if (packet.phase === 'downloading' && this.currentProgress.phase === 'building') {
          this.currentProgress = { ...this.currentProgress, total: packet.total };
          this.emit();
          break;
        }
        const pct = packet.total ? Math.round((packet.done / packet.total) * 100) : 0;
        console.log(`[DownloadService] ← progress/${packet.phase} | done=${packet.done}/${packet.total} (${pct}%)`);
        this.currentProgress = {
          ...this.currentProgress,
          state: 'downloading',
          phase: packet.phase,
          done: packet.done,
          total: packet.total,
        };
        this.emit();
        break;
      }

      case 'completed':
        console.log(`[DownloadService] ← completed | total=${packet.total} archive_url=${packet.archive_url}`);
        this.currentProgress = {
          ...this.currentProgress,
          state: 'saving',
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
          fatalStep: packet.step ?? null,
          fatalMessage: packet.message ?? null,
          errorMessage: this.fatalStepToMessage(packet.step ?? 0),
        };
        this.emit();
        break;

      case 'chapter_report':
        console.log(`[DownloadService] ← chapter_report | chapter="${packet.chapter}" status=${packet.status}`);
        this.currentProgress = {
          ...this.currentProgress,
          chapterReports: [...this.currentProgress.chapterReports, packet],
        };
        this.emit();
        break;

      case 'zipping':
        // Sent after every chapter has been built, right before the outer ZIP is
        // written. With the unified phase there are no in-flight image packets to
        // race, so this transition is unconditional.
        console.log(`[DownloadService] ← zipping | chapters=${packet.chapters} format=${packet.format} - writing outer ZIP (may be silent for ~2 min on large archives)`);
        this.currentProgress = {
          ...this.currentProgress,
          state: 'zipping',
          archivingChapters: packet.chapters ?? null,
          archivingFormat: packet.format ?? null,
        };
        this.emit();
        break;
    }
  }

  private async downloadArchive(archiveUrl: string): Promise<void> {
    const url = archiveUrl.startsWith('http')
      ? archiveUrl
      : `${environment.apiUrl}${archiveUrl}`;
    console.log(`[DownloadService] Fetching archive blob - GET ${url}`);
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
      // Prefer the server-provided filename (handles .offtoon vs .zip correctly).
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `${this.slug || 'chapters'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      console.log(`[DownloadService] Archive offered to browser (${(blob.size / 1024 / 1024).toFixed(2)} MB) - closing WS`);
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
      case 4: return 'Failed to download chapter images - the CDN may be unreachable.';
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



