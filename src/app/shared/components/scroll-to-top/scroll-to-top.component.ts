import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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

  constructor(private cdr: ChangeDetectorRef) {
    this.boundOnScroll = this.onScroll.bind(this);
  }

  ngOnInit() {
    // Initialization logic moved to ngAfterViewInit
  }

  ngAfterViewInit() {
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



