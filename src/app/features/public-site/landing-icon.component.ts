import { Component, input } from '@angular/core';

export type LandingIcon =
  | 'arrow'
  | 'external'
  | 'left'
  | 'right'
  | 'wallet'
  | 'transfer'
  | 'card'
  | 'target'
  | 'shield'
  | 'lock'
  | 'fingerprint'
  | 'check'
  | 'plus'
  | 'mail'
  | 'phone'
  | 'chart';

/** Small, consistent SVG symbols for the public site's controls and features. */
@Component({
  selector: 'app-landing-icon',
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path [attr.d]="paths[name()]" />
  </svg>`,
  styles: [
    ':host{display:inline-flex;flex-shrink:0;width:1.25em;height:1.25em;align-items:center;justify-content:center}svg{width:100%;height:100%;display:block}',
  ],
})
export class LandingIconComponent {
  readonly name = input<LandingIcon>('arrow');
  readonly paths: Record<LandingIcon, string> = {
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    external: 'M6 18 18 6M6 6h12v12',
    left: 'm15 5-7 7 7 7',
    right: 'm9 5 7 7-7 7',
    wallet: 'M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6m18 7h-5v4h5m-3-2h.01',
    transfer: 'M3 7h17m-5-5 5 5-5 5M21 17H4m5-5-5 5 5 5',
    card: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM3 9h18M7 15h4',
    target: 'M20 12a8 8 0 1 1-8-8m4 8a4 4 0 1 1-4-4m0 4 9-9m-4 0h4v4',
    shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7L12 3Zm-5 9 3 3 7-7',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm6 4v3',
    fingerprint:
      'M3 10a9 9 0 0 1 18 0M6 12v-2a6 6 0 0 1 12 0v5m-9 5v-10a3 3 0 0 1 6 0v7m-3-7v12m-9-8v2m3-1v5m12-2v3m3-8v5',
    check: 'm5 12 4 4L19 6',
    plus: 'M12 5v14M5 12h14',
    mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 1 9 7 9-7',
    phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm3 16h2',
    chart: 'M4 3v17h17M8 15l4-5 4 2 5-7',
  };
}
