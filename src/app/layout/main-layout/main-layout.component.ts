import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, HeaderComponent],
  template: `
    <div class="layout-container">
      <app-sidebar></app-sidebar>
      <div class="content-wrapper">
        <app-header></app-header>
        <main class="page-body">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .layout-container {
      display: flex;
      min-height: 100vh;
      background-color: var(--bg-canvas);
      position: relative;
    }

    .content-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow-x: hidden;
    }

    .page-body {
      flex: 1;
      padding: 24px 32px 48px;
      max-width: 1600px;
      width: 100%;
      margin: 0 auto;

      @media (max-width: 768px) {
        padding: 14px 12px 32px;
      }
    }
  `]
})
export class MainLayoutComponent {}
