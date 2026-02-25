import {Component, Input, TemplateRef} from '@angular/core';
import {ButtonModule} from "primeng/button";
import {TranslateModule} from "@ngx-translate/core";
import {FormsModule} from "@angular/forms";
import {NgOptimizedImage} from '@angular/common';
import {FooterComponent} from '@shared/components/footer/footer.component';

@Component({
    selector: 'app-basic-layout',
    standalone: true,
  imports: [
    ButtonModule,
    TranslateModule,
    FormsModule,
    NgOptimizedImage,
    FooterComponent,
  ],
    templateUrl: './basic-layout.component.html',
    styleUrl: './basic-layout.component.scss'
})
export class BasicLayoutComponent {

  protected readonly logoPath = "assets/img/logov3_dark.png";
  @Input() actionsTemplate!: TemplateRef<unknown>;

  constructor() {}

  home() {
    // Hard reset to home URL - forces a full page reload
    window.location.href = `/`;
  }
}
