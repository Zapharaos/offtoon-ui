import { Component } from '@angular/core';
import {TableModule} from "primeng/table";
import {BasicLayoutComponent} from '@shared/layouts/basic-layout/basic-layout.component';
import {TranslatePipe} from '@ngx-translate/core';
import {ScrollToTopComponent} from '@shared/components/scroll-to-top/scroll-to-top.component';

@Component({
    selector: 'app-privacy',
  imports: [
    TableModule,
    BasicLayoutComponent,
    TranslatePipe,
    ScrollToTopComponent
  ],
    templateUrl: './privacy.component.html',
    styleUrl: './privacy.component.scss'
})
export class PrivacyComponent {

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
