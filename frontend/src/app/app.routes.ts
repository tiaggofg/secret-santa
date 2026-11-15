import { Routes } from '@angular/router';
import { HomeGroupsPageComponent } from './features/home/home-groups-page.component';
import { RegisterPageComponent } from './features/auth/register-page.component';
import { PublicGroupPageComponent } from './features/public-group/public-group-page.component';
import { AdminDashboardPageComponent } from './features/admin/admin-dashboard-page.component';
import { ResetPinPageComponent } from './features/public-group/reset-pin-page.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeGroupsPageComponent
  },
  {
    path: 'cadastro',
    component: RegisterPageComponent
  },
  {
    path: 'g/:groupId',
    component: PublicGroupPageComponent
  },
  {
    path: 'g/:groupId/admin',
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
