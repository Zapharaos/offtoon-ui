import { Injectable, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

/**
 * Holds a Screen Wake Lock so the device does not go to sleep during a long
 * running task (a chapter download can take several minutes with no user input).
 *
 * What it can and cannot do
 *
 *   The browser only exposes a *screen* wake lock, so this keeps the display on
 *   — and with it, idle system sleep — but it cannot stop a sleep the user asks
 *   for explicitly (closing the lid, choosing Sleep from the OS menu).
 *
 *   The lock is also dropped by the browser as soon as the document is hidden,
 *   so `acquire()` keeps listening on `visibilitychange` and takes the lock back
 *   when the tab returns to the foreground. While the tab is in the background
 *   there is no web API that can hold sleep off.
 *
 * SSR-safe and unsupported-browser-safe: every method is a no-op outside a
 * browser or where the API is missing — it needs a secure context, so it is
 * absent over plain HTTP other than localhost. Callers never need a guard.
 */
@Injectable({ providedIn: 'root' })
export class WakeLockService implements OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private sentinel: WakeLockSentinel | null = null;

  /**
   * Whether a caller currently wants the screen kept awake.  This is the source
   * of truth rather than `sentinel`, which the browser revokes on its own every
   * time the tab is hidden.
   */
  private wanted = false;

  private readonly onVisibilityChange = (): void => {
    if (this.wanted && this.doc.visibilityState === 'visible') {
      void this.request();
    }
  };

  /** Whether this browser exposes the Screen Wake Lock API at all. */
  get supported(): boolean {
    return this.isBrowser && 'wakeLock' in navigator;
  }

  /**
   * Requests the wake lock and keeps it held until {@link release}.
   *
   * Safe to call repeatedly: a second call while the lock is held does nothing.
   * The request itself is fire-and-forget — failing to keep the screen on must
   * never break the task that asked for it.
   */
  acquire(): void {
    if (!this.supported || this.wanted) return;

    this.wanted = true;
    this.doc.addEventListener('visibilitychange', this.onVisibilityChange);
    void this.request();
  }

  /** Releases the wake lock and stops re-acquiring it. */
  release(): void {
    if (!this.wanted) return;

    this.wanted = false;
    this.doc.removeEventListener('visibilitychange', this.onVisibilityChange);

    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel && !sentinel.released) {
      sentinel.release().catch(() => {
        // Already gone (tab hidden, device slept): nothing left to release.
      });
    }
  }

  /**
   * Performs one wake lock request.
   *
   * The promise rejects when the document is hidden or the user agent refuses
   * (battery saver, policy).  Neither is worth surfacing: the download carries
   * on either way, and `visibilitychange` will try again when the tab is back.
   */
  private async request(): Promise<void> {
    if (this.sentinel && !this.sentinel.released) return;

    try {
      const sentinel = await navigator.wakeLock.request('screen');

      // release() may have run while the request was in flight.
      if (!this.wanted) {
        void sentinel.release().catch(() => undefined);
        return;
      }

      this.sentinel = sentinel;
      sentinel.addEventListener('release', () => {
        if (this.sentinel === sentinel) {
          this.sentinel = null;
        }
      });
    } catch (err) {
      console.warn('[WakeLockService] Could not acquire screen wake lock:', err);
    }
  }

  ngOnDestroy(): void {
    this.release();
  }
}
