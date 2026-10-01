import { Routes } from '@angular/router';
import { PublicSiteComponent } from './features/public-site/public-site.component';

export const routes: Routes = [
  { path: '', component: PublicSiteComponent, title: 'Azzu | Banca digital para avanzar' },
  { path: '**', redirectTo: '' },
];
