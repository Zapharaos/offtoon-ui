import {AfterViewInit, Component, signal, OnInit} from '@angular/core';
import {BasicLayoutComponent} from '@shared/layouts/basic-layout/basic-layout.component';
import {FormsModule} from '@angular/forms';
/*import {take} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';*/
import {TableModule} from 'primeng/table';
/*import {DataView} from 'primeng/dataview';
import {NgClass, NgForOf} from '@angular/common';
import {Divider} from 'primeng/divider';
import {SelectButton} from 'primeng/selectbutton';
import {ProgressBar} from 'primeng/progressbar';
import {Skeleton} from 'primeng/skeleton';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {SelectItem} from 'primeng/api';
import {Select} from 'primeng/select';*/
import {ScrollToTopComponent} from '@shared/components/scroll-to-top/scroll-to-top.component';
import {Tag} from 'primeng/tag';

@Component({
  selector: 'app-home',
  imports: [
    BasicLayoutComponent,
    FormsModule,
    TableModule,
    /*DataView,
    NgForOf,
    Divider,
    SelectButton,
    ProgressBar,
    Skeleton,
    TranslatePipe,
    NgClass,
    Select,*/
    ScrollToTopComponent,
    // Tag,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, AfterViewInit {

  /*status = signal<SEARCH_STATUS>(SEARCH_STATUS.DEFAULT);
  results = signal<any[]>([]);
  loading = signal<boolean>(false);
  searchQuery = signal<string>('');

  sortOptions!: SelectItem[];
  sortKey: string = 'a-z';

  // Computed signal for filtered and sorted results
  filteredResults = signal<any[]>([]);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private searchService: SearchService,
    private translateService: TranslateService,
  ) {
    // Initialize sort from saved preference
    this.sortKey = this.searchService.getSavedSort();
  }

  onSortChange(event: any): void {
    this.sortKey = event.value;
    this.searchService.saveSort(this.sortKey);
    this.sort();
  }

  private sort(): void {
    let processed = [...this.results()];

    // Apply sort
    if (this.sortKey) {
      processed.sort((a, b) => {
        switch (this.sortKey) {
          case 'a-z':
            // Sort by name alphabetically
            const nameA = (a.item?.name || a.item?.bricklink_name || '').toLowerCase();
            const nameB = (b.item?.name || b.item?.bricklink_name || '').toLowerCase();
            return nameA.localeCompare(nameB);

          case 'status':
            // Sort by status
            const statusA = a.item?.status || '';
            const statusB = b.item?.status || '';
            return statusB - statusA;

          case 'price_low_high':
            // Sort by price low to high
            const priceA = a.item?.price?.cent_amount || 0;
            const priceB = b.item?.price?.cent_amount || 0;
            return priceA - priceB;

          case 'price_high_low':
            // Sort by price high to low
            const priceHighA = a.item?.price?.cent_amount || 0;
            const priceHighB = b.item?.price?.cent_amount || 0;
            return priceHighB - priceHighA;

          case 'id':
            // Sort by ID (number for sets, element_id for bricks)
            const idA = a.item?.number || a.item?.element_id || '';
            const idB = b.item?.number || b.item?.element_id || '';
            return idA.toString().localeCompare(idB.toString());

          default:
            return 0;
        }
      });
    }

    this.filteredResults.set(processed);
  }*/

  ngOnInit(): void {
    /*// Initialize options after translations are loaded
    this.initializeOptions();

    // Subscribe to language changes to reinitialize options when locale changes
    this.translateService.onLangChange.subscribe(() => {
      this.initializeOptions();
    });

    // Check if we have search results passed via navigation state
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state || history.state;

    if (state && state.searchResults) {
      this.results.set(state.searchResults);
      this.status.set(state.searchStatus || SEARCH_STATUS.MULTIPLE);
      this.searchQuery.set(state.searchQuery || '');
      this.sort();
    }

    // Subscribe to query params to reset state when navigating home without query
    this.route.queryParams.subscribe(params => {
      const q = params['q'];

      // If no query parameter, reset to default state
      if (!q) {
        this.resetSearchState();
      }
    });

    // Subscribe to search results from the search service
    this.searchService.searchResults$.subscribe(result => {
      this.results.set(result.results);
      this.status.set(result.status);
      this.searchQuery.set(result.query);
      // Only clear loading when NOT in an active WS stream —
      // during streaming the searchbar component owns the loading state via loadingChange.
      if (!this.wsProgress()) {
        this.loading.set(false);
      }
      this.sort();
    });*/
  }

  ngAfterViewInit(): void {
    /*// Read initial query param once and trigger search if present
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const q = params['q'];
      if (q && !this.results().length) {
        // On page reload the Angular router state is lost. Before triggering a fresh
        // HTTP/WebSocket search (which may fail for an expired WS session), try to
        // restore the last completed result for this query from sessionStorage.
        const cached = this.searchService.getCachedSearchResult(q);
        if (cached) {
          this.results.set(cached.results);
          this.status.set(cached.status);
          this.searchQuery.set(cached.query);
          this.sort();
          return;
        }

        // No cached result — trigger a fresh search.
        // Loading state will be managed by searchbar component.
        this.searchbarComponent.onSearch(q);
      }
    });*/
  }

  /*private initializeOptions(): void {
    // Use stream() instead of instant() to wait for translations to load
    // This ensures translations are available even if called before loading completes
    const sortKeys = [
      'home.search.sort.a-z',
      'home.search.sort.status',
      'home.search.sort.id'
    ];

    // Wait for translations to be ready
    this.translateService.stream([...sortKeys]).subscribe(() => {
      // Initialize sort options with i18n translation keys
      this.sortOptions = [
        { label: this.translateService.instant('home.search.sort.a-z'), value: 'a-z' },
        { label: this.translateService.instant('home.search.sort.status'), value: 'status' },
        { label: this.translateService.instant('home.search.sort.id'), value: 'id' }
      ];
    });
  }

  private resetSearchState(): void {
    this.status.set(SEARCH_STATUS.DEFAULT);
    this.results.set([]);
    this.loading.set(false);
    this.searchQuery.set('');
    this.filteredResults.set([]);
  }

  isDisplayMaximal(): boolean {
    return this.status() === SEARCH_STATUS.DEFAULT || this.status() === SEARCH_STATUS.NO_RESULTS;
  }

  isDisplayMinimal(): boolean {
    return this.status() === SEARCH_STATUS.SINGLE || this.status() === SEARCH_STATUS.MULTIPLE;
  }

  isDisplayNoResults(): boolean {
    return this.status() === SEARCH_STATUS.NO_RESULTS;
  }

  isDisplayAllResults(): boolean {
    return this.status() === SEARCH_STATUS.MULTIPLE;
  }*/
}
