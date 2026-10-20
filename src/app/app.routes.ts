import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Backend } from './backend';
import { Dashboard } from './pages/dashboard';
import { Inbox } from './pages/inbox';
import { Notifications } from './pages/notifications';
import { Tickets } from './pages/tickets';
import { TicketDetail } from './pages/ticket-detail';
import { TicketHistory } from './pages/ticket-history';
import { Forum } from './pages/forum';
import { Settings } from './pages/settings';
import { Kb } from './pages/kb';
import { Customers } from './pages/customers';
import { PortalHome, PortalInbox, PortalLayout, PortalLogin, PortalNew, PortalNotifications, PortalTicket, portalGuard } from './portal';

/** Team screens: a staff session (Supabase) — open in demo mode. */
const teamGuard: CanActivateFn = async () => {
  const backend = inject(Backend);
  const router = inject(Router); // inject before any await: the injection context ends there
  if (!backend.enabled) return true;
  return (await backend.whenReady()) === 'tech' || router.parseUrl('/login');
};
const team = { canActivate: [teamGuard] };

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/landing').then((m) => m.Landing), title: 'AIOA · Suporte do ecossistema Lex' },
  { path: 'dashboard', ...team, component: Dashboard, title: 'Dashboard · AIOA' },
  { path: 'inbox', ...team, component: Inbox, title: 'Inbox · AIOA' },
  { path: 'notifications', ...team, component: Notifications, title: 'Notificações · AIOA' },
  { path: 'tickets', ...team, component: Tickets, title: 'Tickets · AIOA' },
  { path: 'tickets/:id', ...team, component: TicketDetail, title: 'Ticket · AIOA' },
  { path: 'ticket-history', ...team, component: TicketHistory, title: 'Histórico de tickets · AIOA' },
  { path: 'forum/:id', ...team, component: Forum, title: 'Post · AIOA' },
  { path: 'forum', ...team, component: Forum, title: 'Fórum · AIOA' },
  { path: 'kb', ...team, component: Kb, title: 'Base de conhecimento · AIOA' },
  { path: 'kb/:id', ...team, component: Kb, title: 'Artigo · AIOA' },
  { path: 'customers', ...team, component: Customers, title: 'Clientes · AIOA' },
  { path: 'settings', ...team, component: Settings, title: 'Configurações · AIOA' },
  { path: 'login', component: PortalLogin, title: 'Entrar · AIOA' },
  { path: 'embed', loadComponent: () => import('./embed').then((m) => m.Embed), title: 'Suporte AIOA' },
  { path: 'embed/callback', loadComponent: () => import('./embed-callback').then((m) => m.EmbedCallback), title: 'Entrando · AIOA' },
  { path: 'portal/login', redirectTo: 'login' },
  {
    path: 'portal',
    component: PortalLayout,
    canActivate: [portalGuard],
    children: [
      { path: '', component: PortalHome, title: 'Meus chamados · AIOA' },
      { path: 'novo', component: PortalNew, title: 'Abrir chamado · AIOA' },
      { path: 'chamados/:id', component: PortalTicket, title: 'Chamado · AIOA' },
      { path: 'inbox', component: PortalInbox, title: 'Inbox · AIOA' },
      { path: 'notificacoes', component: PortalNotifications, title: 'Notificações · AIOA' },
      { path: 'forum', component: Forum, data: { portal: true }, title: 'Fórum · AIOA' },
      { path: 'forum/:id', component: Forum, data: { portal: true }, title: 'Post · AIOA' },
      { path: 'historico', component: TicketHistory, data: { portal: true }, title: 'Histórico de tickets · AIOA' },
      { path: 'kb', component: Kb, data: { portal: true }, title: 'Base de conhecimento · AIOA' },
      { path: 'kb/:id', component: Kb, data: { portal: true }, title: 'Artigo · AIOA' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
