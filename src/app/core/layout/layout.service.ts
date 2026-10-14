import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  isSidebarOpen = signal<boolean>(false);
  isMobileHubOpen = signal<boolean>(false);

  toggleSidebar(): void {
    this.isSidebarOpen.update(v => !v);
    if (this.isSidebarOpen()) {
      this.isMobileHubOpen.set(false);
    }
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  openSidebar(): void {
    this.isSidebarOpen.set(true);
    this.isMobileHubOpen.set(false);
  }

  toggleMobileHub(): void {
    this.isMobileHubOpen.update(v => !v);
    if (this.isMobileHubOpen()) {
      this.isSidebarOpen.set(false);
    }
  }

  closeMobileHub(): void {
    this.isMobileHubOpen.set(false);
  }

  openMobileHub(): void {
    this.isMobileHubOpen.set(true);
    this.isSidebarOpen.set(false);
  }
}
