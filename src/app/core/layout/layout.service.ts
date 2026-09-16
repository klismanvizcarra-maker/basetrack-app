import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  isSidebarOpen = signal<boolean>(false);

  toggleSidebar(): void {
    this.isSidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  openSidebar(): void {
    this.isSidebarOpen.set(true);
  }
}
