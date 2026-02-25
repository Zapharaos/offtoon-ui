import {AfterViewInit, Component, signal, OnInit} from '@angular/core';
import {BasicLayoutComponent} from '@shared/layouts/basic-layout/basic-layout.component';
import {FormsModule} from '@angular/forms';
import {TableModule} from 'primeng/table';
import {ScrollToTopComponent} from '@shared/components/scroll-to-top/scroll-to-top.component';

@Component({
  selector: 'app-home',
  imports: [
    BasicLayoutComponent,
    FormsModule,
    TableModule,
    ScrollToTopComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, AfterViewInit {

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
  }
}
