import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Button } from 'primeng/button';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'app-scroll-to-top',
  standalone: true,
  imports: [CommonModule, Button, TranslatePipe],
  templateUrl: './scroll-to-top.component.html',
  styleUrl: './scroll-to-top.component.scss'
})
export class ScrollToTopComponent implements OnInit, AfterViewInit, OnDestroy {
  isVisible = false;
  private scrollContainer: HTMLElement | null = null;
  private boundOnScroll: () => void;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private cdr: ChangeDetectorRef) {
    this.boundOnScroll = this.onScroll.bind(this);
  }

  ngOnInit() {
    // Initialization logic moved to ngAfterViewInit
  }

  ngAfterViewInit() {
    // Browser-only : le setTimeout/addEventListener ferait échouer le prerender (NG0401).
    if (!this.isBrowser) return;
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      // Find the scrollable container (the div with overflow-y-auto)
      this.scrollContainer = document.querySelector('.overflow-y-auto') as HTMLElement;

      if (this.scrollContainer) {
        this.scrollContainer.addEventListener('scroll', this.boundOnScroll);
      }
    }, 0);
  }

  ngOnDestroy() {
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.boundOnScroll);
    }
  }

  private onScroll() {
    if (this.scrollContainer) {
      // Show button after scrolling down 300px
      const newVisibility = this.scrollContainer.scrollTop > 300;
      if (this.isVisible !== newVisibility) {
        this.isVisible = newVisibility;
        this.cdr.detectChanges();
      }
    }
  }

  scrollToTop() {
    if (this.scrollContainer) {
      this.scrollContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }
}



