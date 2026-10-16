import { RenderMode, ServerRoute } from '@angular/ssr';

// Client-only: the prototype keeps its data in localStorage, which the server can't see.
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Client }];
