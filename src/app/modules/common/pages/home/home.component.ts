import {Component} from '@angular/core';
import {BasicLayoutComponent} from '@shared/layouts/basic-layout/basic-layout.component';
import {FormsModule} from '@angular/forms';
import {ScrollToTopComponent} from '@shared/components/scroll-to-top/scroll-to-top.component';
import {ToonService} from '@core/api/api/toon.service';
import {ApiSource} from '@core/api/model/apiSource';
import {ApiCustomURL} from '@core/api/model/apiCustomURL';
import {ToonSearchResult} from '@core/api/model/toonSearchResult';
import {HandlersSearchRequest} from '@core/api/model/handlersSearchRequest';
import {finalize} from 'rxjs';
import {NotificationUtilsService} from '@shared/services/notification-utils.service';
import {DataViewModule} from 'primeng/dataview';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {CheckboxModule} from 'primeng/checkbox';
import {SkeletonModule} from 'primeng/skeleton';
import {TagModule} from 'primeng/tag';
import {TranslateModule} from '@ngx-translate/core';
import {Router} from '@angular/router';

export interface SourceConfig {
  key: ApiSource;
  label: string;
  selected: boolean;
  customUrl: string;
}

@Component({
  selector: 'app-home',
  imports: [
    BasicLayoutComponent,
    FormsModule,
    ScrollToTopComponent,
    DataViewModule,
    ButtonModule,
    InputTextModule,
    CheckboxModule,
    SkeletonModule,
    TagModule,
    TranslateModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

  searchInput = '';
  loading = false;
  searched = false;
  results: ToonSearchResult[] = [];

  sources: SourceConfig[] = [
    {key: ApiSource.SourceAsura, label: 'Asura', selected: true, customUrl: ''},
    {key: ApiSource.SourceNato, label: 'Nato', selected: true, customUrl: ''},
  ];

  constructor(
    private toonService: ToonService,
    private notificationUtils: NotificationUtilsService,
    private router: Router,
  ) {}

  get selectedSources(): SourceConfig[] {
    return this.sources.filter(s => s.selected);
  }

  get canSearch(): boolean {
    return this.searchInput.trim().length > 0 && this.selectedSources.length > 0;
  }

  get skeletonArray(): number[] {
    return Array(6).fill(0);
  }

  search(): void {
    if (!this.canSearch) return;

    const customUrls: ApiCustomURL[] = this.selectedSources
      .filter(s => s.customUrl.trim().length > 0)
      .map(s => ({source: s.key, url: s.customUrl.trim()}));

    const body: HandlersSearchRequest = {
      input: this.searchInput.trim(),
      sources: this.selectedSources.map(s => s.key),
      ...(customUrls.length > 0 ? {custom_urls: customUrls} : {}),
    };

    this.loading = true;
    this.searched = false;
    this.results = [];

    this.toonService.apiV1SearchPost(body)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (data) => {
          this.results = data ?? [];
          this.searched = true;
        },
        error: (err) => {
          this.notificationUtils.showToastError('Search failed', err);
          this.searched = true;
        },
      });
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.search();
    }
  }

  navigateToToon(result: ToonSearchResult): void {
    if (!result.id || !result.source) return;
    const sourceConfig = this.sources.find(s => s.key === result.source);
    const customUrl = sourceConfig?.customUrl?.trim();
    this.router.navigate(['/toon', result.source, result.id], {
      ...(customUrl ? {queryParams: {url: customUrl}} : {}),
    });
  }
}
