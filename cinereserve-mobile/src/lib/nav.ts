import type { UseIonRouterResult } from '@ionic/react';

/** `root` starts a fresh history (e.g. after payment) so Back can't return into a finished flow. */
export function navigate(router: UseIonRouterResult, path: string, root = false) {
  (document.activeElement as HTMLElement | null)?.blur();
  if (root) {
    router.navigateRoot(path);
  } else {
    router.push(path);
  }
}
