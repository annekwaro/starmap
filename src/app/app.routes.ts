import { Routes } from '@angular/router';
import { LandingComponent } from './landing/landing.component';
import { MoonTabComponent } from './sky/moon-tab.component';
import { PlanetsTabComponent } from './sky/planets-tab.component';
import { SkyShellComponent } from './sky/sky-shell.component';
import { SkyTabComponent } from './sky/sky-tab.component';

const APP = 'The Sky on the Night You Were Born';

export const routes: Routes = [
  { path: '', component: LandingComponent, title: APP },
  {
    path: 'sky',
    component: SkyShellComponent,
    children: [
      { path: '', component: SkyTabComponent, title: `Sky · ${APP}` },
      { path: 'planets', component: PlanetsTabComponent, title: `Planets · ${APP}` },
      { path: 'moon', component: MoonTabComponent, title: `Moon · ${APP}` },
    ],
  },
  { path: '**', redirectTo: '' },
];
