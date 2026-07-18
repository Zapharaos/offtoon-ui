import {Component, OnInit} from '@angular/core';
import {BasicLayoutComponent} from '@shared/layouts/basic-layout/basic-layout.component';
import {FormsModule} from '@angular/forms';
import {ScrollToTopComponent} from '@shared/components/scroll-to-top/scroll-to-top.component';
import {ToonService} from '@core/api/api/toon.service';
import {AnalyticsService} from '@core/services/analytics.service';
import {ApiSource} from '@core/api/model/apiSource';
import {ToonSearchResult} from '@core/api/model/toonSearchResult';
import {ToonSource} from '@core/api/model/toonSource';
import {ToonStatus} from '@core/api/model/toonStatus';
import {HandlersSearchRequest} from '@core/api/model/handlersSearchRequest';
import {finalize} from 'rxjs';
import {NotificationUtilsService} from '@shared/services/notification-utils.service';
import {DataViewModule} from 'primeng/dataview';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {MultiSelectModule} from 'primeng/multiselect';
import {SkeletonModule} from 'primeng/skeleton';
import {TagModule} from 'primeng/tag';
import {SelectModule} from 'primeng/select';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ActivatedRoute, Router} from '@angular/router';

export interface SourceConfig {
  key: ApiSource;
  label: string;
}

export interface SortOption {
  label: string;
  value: 'az' | 'source' | 'chapters_asc' | 'chapters_desc' | 'status';
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
    MultiSelectModule,
    SkeletonModule,
    TagModule,
    SelectModule,
    TranslateModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {

  searchInput = '';
  loading = false;
  searched = false;
  results: ToonSearchResult[] = [];
  selectedSort: SortOption | null = null;

  sources: SourceConfig[] = [
    {key: ApiSource.SourceAsura, label: 'Asura'},
  ];

  selectedSourcesList: SourceConfig[] = [];

  sortOptions: SortOption[] = [];

  constructor(
    private toonService: ToonService,
    private notificationUtils: NotificationUtilsService,
    private router: Router,
    private route: ActivatedRoute,
    private translate: TranslateService,
    private analytics: AnalyticsService,
  ) {
    this.sortOptions = [
      {label: this.translate.instant('home.search.sort.az'),            value: 'az'},
      {label: this.translate.instant('home.search.sort.source'),        value: 'source'},
      {label: this.translate.instant('home.search.sort.status'),        value: 'status'},
      {label: this.translate.instant('home.search.sort.chapters-asc'),  value: 'chapters_asc'},
      {label: this.translate.instant('home.search.sort.chapters-desc'), value: 'chapters_desc'},
    ];
  }

  ngOnInit(): void {
    // Default: all sources selected
    this.selectedSourcesList = [...this.sources];

    const params = this.route.snapshot.queryParamMap;
    const q = params.get('q');
    const sourcesParam = params.getAll('sources');

    if (sourcesParam.length > 0) {
      this.selectedSourcesList = this.sources.filter(s => sourcesParam.includes(s.key));
    }

    if (q) {
      this.searchInput = q;
      this.search();
    }
  }

  isSourceSelected(source: SourceConfig): boolean {
    return this.selectedSourcesList.some(s => s.key === source.key);
  }

  get selectedSources(): SourceConfig[] {
    return this.selectedSourcesList;
  }

  get canSearch(): boolean {
    return this.searchInput.trim().length > 0 && this.selectedSourcesList.length > 0;
  }

  get skeletonArray(): number[] {
    return Array(6).fill(0);
  }

  get sortedResults(): ToonSearchResult[] {
    if (!this.selectedSort) return this.results;
    const copy = [...this.results];
    switch (this.selectedSort.value) {
      case 'az':
        return copy.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
      case 'source':
        return copy.sort((a, b) => (a.source ?? '').localeCompare(b.source ?? ''));
      case 'status': {
        const order: Record<string, number> = {
          [ToonStatus.StatusOngoing]:   0,
          [ToonStatus.StatusCompleted]: 1,
          [ToonStatus.StatusSeasonEnd]: 2,
          [ToonStatus.StatusHiatus]:    3,
          [ToonStatus.StatusDropped]:   4,
          [ToonStatus.StatusUnknown]:   5,
        };
        return copy.sort((a, b) =>
          (order[a.status ?? ''] ?? 99) - (order[b.status ?? ''] ?? 99)
        );
      }
      case 'chapters_asc':
        return copy.sort((a, b) => (a.last_chapter ?? 0) - (b.last_chapter ?? 0));
      case 'chapters_desc':
        return copy.sort((a, b) => (b.last_chapter ?? 0) - (a.last_chapter ?? 0));
    }
  }

  sourceLabel(source: ToonSource | string | undefined): string {
    switch (source) {
      case ToonSource.SourceAsura: return 'Asura';
      default: return source ?? '';
    }
  }

  statusSeverity(status: ToonStatus | string | undefined): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case ToonStatus.StatusOngoing:    return 'info';
      case ToonStatus.StatusCompleted:  return 'success';
      case ToonStatus.StatusHiatus:     return 'warn';
      case ToonStatus.StatusDropped:    return 'danger';
      case ToonStatus.StatusSeasonEnd:  return 'secondary';
      default:                          return 'secondary';
    }
  }

  statusLabel(status: ToonStatus | string | undefined): string {
    switch (status) {
      case ToonStatus.StatusOngoing:    return 'Ongoing';
      case ToonStatus.StatusCompleted:  return 'Completed';
      case ToonStatus.StatusHiatus:     return 'Hiatus';
      case ToonStatus.StatusDropped:    return 'Dropped';
      case ToonStatus.StatusSeasonEnd:  return 'Season End';
      case ToonStatus.StatusUnknown:    return 'Unknown';
      default:                          return status ?? '';
    }
  }

  search(): void {
    if (!this.canSearch) return;

    const body: HandlersSearchRequest = {
      input: this.searchInput.trim(),
      sources: this.selectedSources.map(s => s.key),
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchInput.trim(),
        sources: this.selectedSources.map(s => s.key),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    this.loading = true;
    this.searched = false;
    this.results = [];

    this.toonService.apiV1SearchPost(body)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (data) => {
          this.results = data ?? [];
          this.searched = true;
          const query = (body.input ?? '').slice(0, 100);
          this.analytics.track('search', { result_count: this.results.length, query, sources: body.sources });
          if (this.results.length === 0) {
            this.analytics.track('search-no-results', { query });
          }
        },
        error: (err) => {
          this.notificationUtils.showToastError('Search failed', err);
          this.searched = true;
          this.analytics.track('search-error', { query: (body.input ?? '').slice(0, 100) });
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
    this.router.navigate(['/toon', result.source, result.id], {
      state: {
        back_q: this.searchInput.trim(),
        back_sources: this.selectedSources.map(s => s.key),
      },
    });
  }
}
