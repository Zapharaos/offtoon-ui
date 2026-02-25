import {Component, Input, TemplateRef} from '@angular/core';
import {ButtonModule} from "primeng/button";
import {TranslateModule} from "@ngx-translate/core";
import {FormsModule} from "@angular/forms";
import {NgOptimizedImage} from '@angular/common';
import {FooterComponent} from '@shared/components/footer/footer.component';
import {LocaleService} from '@core/services/locale.service';

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

  protected readonly logoPath = "assets/img/logo.svg";
  @Input() actionsTemplate!: TemplateRef<unknown>;

  constructor(
    private localeService: LocaleService,
  ) {
  }

  home() {
    // Hard reset to home URL - forces a full page reload
    window.location.href = `/${this.localeService.getUrlPath()}`;
  }
}
