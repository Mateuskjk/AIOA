import { Routes } from '@angular/router';
import { Dashboard } from './pages/dashboard';
import { Inbox } from './pages/inbox';
import { Notifications } from './pages/notifications';
import { Tickets } from './pages/tickets';
import { TicketDetail } from './pages/ticket-detail';
import { TicketHistory } from './pages/ticket-history';
import { Forum } from './pages/forum';
import { Report } from './pages/report';
import { Settings } from './pages/settings';
import { Kb } from './pages/kb';
import { Customers } from './pages/customers';
import { PortalHome, PortalLayout, PortalLogin, PortalNew, PortalTicket, portalGuard } from './portal';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: Dashboard, title: 'Dashboard · AIOA' },
  { path: 'inbox', component: Inbox, title: 'Inbox · AIOA' },
  { path: 'notifications', component: Notifications, title: 'Notificações · AIOA' },
  { path: 'tickets', component: Tickets, title: 'Tickets · AIOA' },
  { path: 'tickets/:id', component: TicketDetail, title: 'Ticket · AIOA' },
  { path: 'ticket-history', component: TicketHistory, title: 'Histórico de tickets · AIOA' },
  { path: 'forum', component: Forum, title: 'Fórum · AIOA' },
  { path: 'report', component: Report, title: 'Report · AIOA' },
  { path: 'kb', component: Kb, title: 'Base de conhecimento · AIOA' },
  { path: 'kb/:id', component: Kb, title: 'Artigo · AIOA' },
  { path: 'customers', component: Customers, title: 'Clientes · AIOA' },
  { path: 'settings', component: Settings, title: 'Configurações · AIOA' },
  { path: 'portal/login', component: PortalLogin, title: 'Portal do cliente · AIOA' },
  {
    path: 'portal',
    component: PortalLayout,
    canActivate: [portalGuard],
    children: [
      { path: '', component: PortalHome, title: 'Meus chamados · AIOA' },
      { path: 'novo', component: PortalNew, title: 'Abrir chamado · AIOA' },
      { path: 'chamados/:id', component: PortalTicket, title: 'Chamado · AIOA' },
      { path: 'kb', component: Kb, data: { portal: true }, title: 'Base de conhecimento · AIOA' },
      { path: 'kb/:id', component: Kb, data: { portal: true }, title: 'Artigo · AIOA' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
