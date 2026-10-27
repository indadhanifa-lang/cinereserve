import type { UseIonRouterResult } from '@ionic/react';

export function navigate(router: UseIonRouterResult, path: string) {
  (document.activeElement as HTMLElement | null)?.blur();
  router.push(path);
}
