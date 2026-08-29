import { api } from '@appdeploy/client';

/* The close's "Haan" button. The number never reaches this file or the page
   source — the backend reads it from an encrypted app secret and hands back a
   finished WhatsApp link only when the button is actually pressed. */
const link = document.querySelector<HTMLAnchorElement>('[data-haan]');

link?.addEventListener('click', async (event) => {
  event.preventDefault();
  if (link.dataset.busy === '1') return;
  link.dataset.busy = '1';
  try {
    const res = await api.get('/api/haan');
    const url = (res?.data as { url?: string } | undefined)?.url;
    if (url) { location.href = url; return; }
  } catch {
    /* fall through to the note below */
  }
  link.dataset.busy = '';
  const note = document.querySelector<HTMLElement>('[data-haan-note]');
  if (note) note.textContent = 'WhatsApp abhi nahi khul raha — bas mujhe wahin message kar do.';
});
