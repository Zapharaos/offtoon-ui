import {Component, OnInit} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {PrimeNG} from 'primeng/config';
import {LocaleService} from '@core/services/locale.service';
import {SeoService} from '@core/services/seo.service';
import {AnalyticsService} from '@core/services/analytics.service';
import {Toast} from 'primeng/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  constructor(private config: PrimeNG,
              private translateService: TranslateService,
              private localeService: LocaleService,
              private seo: SeoService,
              private analytics: AnalyticsService) {
  }

  ngOnInit() {
    this.translateService.get('primeng').subscribe(res => this.config.setTranslation(res));

    // Set initial translation language based on current locale config
    const translationFile = this.localeService.getTranslationFile();
    this.translateService.use(translationFile);

    // Meta/OG/canonical per route (subscribes to navigation).
    this.seo.init();

    // Injects the umami tracking script (browser-only; no-op if config empty).
    this.analytics.init();
  }
}
