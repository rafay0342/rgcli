import { router, json, error, secrets } from '@appdeploy/sdk';

/* The close's "Haan" button asks for this. The number lives in an encrypted
   app secret, so it is in neither the repository nor the page source. */
const SECRET = 'WHATSAPP_NUMBER';

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
  'GET /api/haan': [
    async () => {
      const names = await secrets.listSecretNames();
      if (!names.includes(SECRET)) return error('WhatsApp number is not configured yet.', 503);
      const digits = (await secrets.readSecret(SECRET)).replace(/\D/g, '');
      if (!digits) return error('WhatsApp number is not configured yet.', 503);
      return json({ url: 'https://wa.me/' + digits + '?text=' + encodeURIComponent('Haan') });
    }
  ]
});
