import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp({ credential: applicationDefault() });

await getAuth().projectConfigManager().updateProjectConfig({
  multiFactorConfig: {
    providerConfigs: [{
      state: 'ENABLED',
      totpProviderConfig: {
        adjacentIntervals: 5,
      },
    }],
  },
});

console.log('TOTP enabled ✅');