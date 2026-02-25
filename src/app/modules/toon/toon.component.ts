import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {finalize} from 'rxjs';
import {BasicLayoutComponent} from '@shared/layouts/basic-layout/basic-layout.component';
import {ScrollToTopComponent} from '@shared/components/scroll-to-top/scroll-to-top.component';
import {ToonService} from '@core/api/api/toon.service';
import {ToonToon} from '@core/api/model/toonToon';
import {ToonChapter} from '@core/api/model/toonChapter';
import {ApiSource} from '@core/api/model/apiSource';
import {NotificationUtilsService} from '@shared/services/notification-utils.service';
import {SkeletonModule} from 'primeng/skeleton';
import {TableModule} from 'primeng/table';
import {ButtonModule} from 'primeng/button';
import {TagModule} from 'primeng/tag';
import {TranslateModule} from '@ngx-translate/core';
import {DatePipe} from '@angular/common';

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
    const url = this.route.snapshot.queryParamMap.get('url') ?? undefined;

    this.toonService.apiV1FetchPost({source, slug, ...(url ? {url} : {})})
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (data) => {
          this.toon = data;
        },
        error: (err) => {
          this.notificationUtils.showToastError('Failed to fetch toon', err);
        },
      });
  }

  get skeletonArray(): number[] {
    return Array(8).fill(0);
  }

  get allSelected(): boolean {
    return !!this.toon?.chapters?.length &&
      this.selectedChapters.length === this.toon.chapters.length;
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
