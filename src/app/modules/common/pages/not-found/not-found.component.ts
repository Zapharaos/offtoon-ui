import { Component } from '@angular/core';
import {BasicLayoutComponent} from '@shared/layouts/basic-layout/basic-layout.component';
import {Button} from 'primeng/button';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'app-not-found',
  imports: [
    BasicLayoutComponent,
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
