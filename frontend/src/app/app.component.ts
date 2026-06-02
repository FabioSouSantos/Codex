import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  // CRÍTICO: AppComponent é apenas <router-outlet /> puro (sem navbar).
  template: `<router-outlet />`,
})
export class AppComponent {}
