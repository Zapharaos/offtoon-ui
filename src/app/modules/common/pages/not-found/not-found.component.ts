import { Component } from '@angular/core';
import {BasicLayoutComponent} from '@shared/layouts/basic-layout/basic-layout.component';
import {NgOptimizedImage} from '@angular/common';
import {Button} from 'primeng/button';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {Router} from '@angular/router';
import {LocaleService} from '@core/services/locale.service';

@Component({
  selector: 'app-not-found',
  imports: [
    BasicLayoutComponent,
    NgOptimizedImage,
    Button,
    TranslatePipe
  ],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss'
})
export class NotFoundComponent {
  constructor() { }

  home() {
    // Hard reset to home URL - forces a full page reload
    window.location.href = `/`;
  }
}
