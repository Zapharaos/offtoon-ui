import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {finalize} from 'rxjs';
import {BasicLayoutComponent} from '@shared/layouts/basic-layout/basic-layout.component';
import {ScrollToTopComponent} from '@shared/components/scroll-to-top/scroll-to-top.component';
import {ToonService} from '@core/api/api/toon.service';
import {ToonToon} from '@core/api/model/toonToon';
import {ToonChapter} from '@core/api/model/toonChapter';
import {ToonSource} from '@core/api/model/toonSource';
import {ToonStatus} from '@core/api/model/toonStatus';
import {ApiSource} from '@core/api/model/apiSource';
import {NotificationUtilsService} from '@shared/services/notification-utils.service';
import {SkeletonModule} from 'primeng/skeleton';
import {TableModule} from 'primeng/table';
import {ButtonModule} from 'primeng/button';
import {TagModule} from 'primeng/tag';
import {TranslateModule} from '@ngx-translate/core';
import {DatePipe} from '@angular/common';

// TODO : searchbar review

// TODO : search input in the route, refetch on reload
// TODO : toon page navigation should cache the previous page for back navigation

@Component({
  selector: 'app-toon',
  imports: [
    BasicLayoutComponent,
    ScrollToTopComponent,
    SkeletonModule,
    TableModule,
    ButtonModule,
    TagModule,
    TranslateModule,
    DatePipe,
  ],
  templateUrl: './toon.component.html',
  styleUrl: './toon.component.scss'
})
export class ToonComponent implements OnInit {

  loading = true;
  toon: ToonToon | null = null;
  selectedChapters: ToonChapter[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toonService: ToonService,
    private notificationUtils: NotificationUtilsService,
  ) {}

  ngOnInit(): void {
    const source = this.route.snapshot.paramMap.get('source') as ApiSource;
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';

    this.toonService.apiV1FetchPost({source, slug})
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (data) => { this.toon = data; },
        error: (err) => { this.notificationUtils.showToastError('Failed to fetch toon', err); },
      });
  }

  get skeletonArray(): number[] {
    return Array(8).fill(0);
  }

  get allSelected(): boolean {
    return !!this.toon?.chapters?.length &&
      this.selectedChapters.length === this.toon.chapters.length;
  }

  sourceLabel(source: ToonSource | string | undefined): string {
    switch (source) {
      case ToonSource.SourceAsura: return 'Asura';
      case ToonSource.SourceNato:  return 'Nato';
      default:                     return source ?? '';
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

  goBack(): void {
    this.router.navigate(['/']);
  }

  openChapter(chapter: ToonChapter): void {
    if (chapter.url) {
      window.open(chapter.url, '_blank', 'noopener,noreferrer');
    }
  }
}
