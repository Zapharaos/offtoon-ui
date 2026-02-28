import { Component } from '@angular/core';
import {BasicLayoutComponent} from '@shared/layouts/basic-layout/basic-layout.component';
import {Button} from 'primeng/button';
import {RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {ScrollToTopComponent} from '@shared/components/scroll-to-top/scroll-to-top.component';

@Component({
    selector: 'app-terms',
  imports: [
    BasicLayoutComponent,
    Button,
    RouterLink,
    TranslatePipe,
    ScrollToTopComponent
  ],
    templateUrl: './terms.component.html',
    styleUrl: './terms.component.scss'
})
export class TermsComponent {

  scrollToSection(sectionId: string, event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
