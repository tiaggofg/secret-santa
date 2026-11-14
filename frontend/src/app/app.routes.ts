import { Routes } from '@angular/router';
import { HomeGroupsPageComponent } from './features/home/home-groups-page.component';
import { PublicGroupPageComponent } from './features/public-group/public-group-page.component';
import { AdminDashboardPageComponent } from './features/admin/admin-dashboard-page.component';
import { ResetPinPageComponent } from './features/public-group/reset-pin-page.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeGroupsPageComponent
  },
  {
    path: 'g/:slug',
    component: PublicGroupPageComponent
  },
  {
    path: 'g/:slug/admin',
    component: AdminDashboardPageComponent
  },
  {
    path: 'reset/:token',
    component: ResetPinPageComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];
