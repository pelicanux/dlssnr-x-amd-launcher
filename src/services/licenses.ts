import launcherLicense from '../../LICENSE?raw';
import backendLicense from '../../licenses/DLSSNR-AMD-LICENSE.txt?raw';
import rdna3License from '../../licenses/DLSSNR-RDNA3-LICENSE.txt?raw';
import thirdPartyNotices from '../../licenses/DLSSNR-AMD-THIRD-PARTY.md?raw';

// Original notices are bundled verbatim so they remain available offline.
export const creditLicenses = [
  { id: 'launcher', name: 'DLSSNR X AMD', label: 'MIT · Pelicano', text: launcherLicense, url: 'https://github.com/pelicanux/dlssnr-x-amd-launcher/blob/main/LICENSE' },
  { id: 'backend', name: 'DLSSNR-AMD', label: 'MIT · mochizuki0323', text: backendLicense, url: 'https://github.com/mochizuki0323/DLSSNR-AMD/blob/main/LICENSE' },
  { id: 'rdna3', name: 'DLSSNR-RDNA3', label: 'MIT · mochizuki0323 · mauri870', text: rdna3License, url: 'https://github.com/mauri870/DLSSNR-RDNA3/blob/main/LICENSE' },
  { id: 'thirdParty', name: '', label: 'DLSSNR-AMD', text: thirdPartyNotices, url: 'https://github.com/mochizuki0323/DLSSNR-AMD/blob/main/THIRD_PARTY.md' },
] as const;
