#!/usr/bin/env node
/**
 * Seeds a real Supabase project with the same 5 demo clients the old
 * localStorage prototype shipped with (src/store/seed.js in legacy/),
 * plus one studio login and one client-portal login so Phase A can be
 * verified end to end.
 *
 * NOT a full port of legacy/src/store/seed.js's ~213 posts — that volume
 * exists to make the old UI's grid/pipeline views look populated, which is
 * a Phase B concern once that UI exists here. This inserts every client,
 * account, pillar, format, the Meta connection + pages, and a handful of
 * representative content_items per client — enough to prove every table
 * and every relation actually works.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   SEED_STUDIO_EMAIL=you@studio.test SEED_STUDIO_PASSWORD=... \
 *   SEED_CLIENT_EMAIL=client@test.test SEED_CLIENT_PASSWORD=... \
 *   node scripts/seed.mjs
 *
 * (Reads the same names from .env.local automatically if present.)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(new URL('.', import.meta.url)));

// Minimal .env.local loader — no extra dependency for a one-off script.
function loadEnvLocal() {
  const path = join(ROOT, '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set them in .env.local or the environment).');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function must(res, label) {
  if (res.error) {
    console.error(`✗ ${label}:`, res.error.message);
    process.exit(1);
  }
  return res.data;
}

async function main() {
  console.log('Seeding clients…');

  const clients = [
    {
      name: 'Marefuori', slug: 'marefuori', color: '#2DA7A7', tipo: 'retainer',
      status: 'Attivo', pkg: 'Professional', pkg_hours: 22, revenue: 1200, theme: 'dark',
      referente_nome: 'Giulia Ancona', referente_email: 'giulia@marefuori.it', referente_tel: '+39 0932 110 220',
      note: 'Ristorante di pesce, Marina di Ragusa. Stagionalità forte: da maggio a settembre il feed spinge terrazza e pescato del giorno.',
    },
    {
      name: 'Terrarossa', slug: 'terrarossa', color: '#e40e49', tipo: 'retainer',
      status: 'Attivo', pkg: 'Essential', pkg_hours: 10, revenue: 650, theme: 'dark',
      referente_nome: '', referente_email: '', referente_tel: '', note: '',
    },
    {
      name: 'Vulcano Lab', slug: 'vulcano-lab', color: '#F2C700', tipo: 'oneshot',
      status: 'Attivo', progetto_nome: 'Rebrand + sito', progetto_deadline: '2026-12-18', budget: 3500, theme: 'dark',
      referente_nome: '', referente_email: '', referente_tel: '', note: '',
    },
    {
      name: 'Nodo Studio', slug: 'nodo-studio', color: '#e40e49', tipo: 'oneshot',
      status: 'Attivo', budget: 2800, theme: 'light',
      referente_nome: '', referente_email: '', referente_tel: '', note: '',
    },
    {
      name: 'Kalát', slug: 'kalat', color: '#2DA7A7', tipo: 'retainer',
      status: 'Attivo', pkg: 'Starter', pkg_hours: 6, revenue: 400, theme: 'dark',
      referente_nome: '', referente_email: '', referente_tel: '', note: '',
    },
  ];

  const insertedClients = must(await db.from('clients').insert(clients).select(), 'insert clients');
  const byName = Object.fromEntries(insertedClients.map((c) => [c.name, c]));

  console.log(`✓ ${insertedClients.length} clients`);

  console.log('Seeding accounts, pillars, formats…');

  const accountsSeed = [
    { client: 'Marefuori', platform: 'Instagram', handle: '@marefuori.ragusa' },
    { client: 'Marefuori', platform: 'Facebook', handle: 'Marefuori Ragusa' },
    { client: 'Terrarossa', platform: 'Instagram', handle: '@terrarossa' },
    { client: 'Vulcano Lab', platform: 'Instagram', handle: '@vulcanolab' },
    { client: 'Vulcano Lab', platform: 'TikTok', handle: '@vulcanolab' },
    { client: 'Nodo Studio', platform: 'Instagram', handle: '@nodostudio' },
    { client: 'Nodo Studio', platform: 'LinkedIn', handle: 'Nodo Studio' },
    { client: 'Kalát', platform: 'Instagram', handle: '@kalat.forno' },
  ];
  const accounts = must(
    await db
      .from('accounts')
      .insert(accountsSeed.map((a) => ({ client_id: byName[a.client].id, platform: a.platform, handle: a.handle })))
      .select(),
    'insert accounts'
  );
  console.log(`✓ ${accounts.length} accounts`);

  const pillarsSeed = [
    { client: 'Marefuori', name: 'Pescato del giorno', color: '#2DA7A7' },
    { client: 'Marefuori', name: 'Terrazza & atmosfera', color: '#F2C700' },
    { client: 'Marefuori', name: 'Dietro le quinte', color: '#f37c7b' },
    { client: 'Terrarossa', name: 'Vino', color: '#e40e49' },
    { client: 'Terrarossa', name: 'Cantina', color: '#F2C700' },
    { client: 'Vulcano Lab', name: 'Prodotto', color: '#F2C700' },
    { client: 'Nodo Studio', name: 'Processo', color: '#F2C700' },
    { client: 'Kalát', name: 'Forno', color: '#F2C700' },
  ];
  const pillars = must(
    await db
      .from('pillars')
      .insert(pillarsSeed.map((p) => ({ client_id: byName[p.client].id, name: p.name, color: p.color })))
      .select(),
    'insert pillars'
  );
  console.log(`✓ ${pillars.length} pillars`);

  const formatsSeed = [
    { client: 'Marefuori', name: 'Foto singola', ratio: '4/5' },
    { client: 'Marefuori', name: 'Carosello', ratio: '4/5' },
    { client: 'Marefuori', name: 'Reel', ratio: '9/16' },
  ];
  const formats = must(
    await db
      .from('formats')
      .insert(formatsSeed.map((f) => ({ client_id: byName[f.client].id, name: f.name, ratio: f.ratio })))
      .select(),
    'insert formats'
  );
  console.log(`✓ ${formats.length} formats`);

  console.log('Seeding a handful of content items…');

  const mfIg = accounts.find((a) => a.handle === '@marefuori.ragusa');
  const pescato = pillars.find((p) => p.name === 'Pescato del giorno');
  const carosello = formats.find((f) => f.name === 'Carosello');

  const items = [
    {
      client_id: byName.Marefuori.id, account_id: mfIg.id, kind: 'feed', type: 'photo',
      url: 'https://picsum.photos/seed/mf1/1080/1350', date: '2026-09-02',
      copy: 'Il pescato di stamattina. Ricciola, gambero rosso, totani.',
      pillar_id: pescato.id, appr_stato: 'pubblicato', slides: [],
    },
    {
      client_id: byName.Marefuori.id, account_id: mfIg.id, kind: 'feed', type: 'carousel',
      url: 'https://picsum.photos/seed/mf2/1080/1350', date: '2026-09-10',
      copy: 'Weekend pieno — restano due tavoli per sabato.',
      pillar_id: pescato.id, format_id: carosello.id, appr_stato: 'approvare',
      // supabase-js batch inserts derive the column set from the UNION of
      // every object's keys — an object missing `slides` gets an explicit
      // NULL for it (not "column omitted, use the DEFAULT"), which trips
      // the NOT NULL constraint. Every item in this batch sets it.
      slides: [
        { url: 'https://picsum.photos/seed/mf2a/1080/1350', externalUrl: '', videoUrl: '', name: 'slide-1.jpg', copy: '', note: '' },
        { url: 'https://picsum.photos/seed/mf2b/1080/1350', externalUrl: '', videoUrl: '', name: 'slide-2.jpg', copy: 'Passaggio 2', note: '' },
      ],
    },
    {
      client_id: byName.Marefuori.id, account_id: mfIg.id, kind: 'feed', type: 'photo',
      url: 'https://picsum.photos/seed/mf3/1080/1350', date: '2026-09-16',
      copy: 'Non è un tramonto qualsiasi, è quello di ogni sera qui.',
      appr_stato: 'bozza', slides: [],
    },
  ];
  const inserted = must(await db.from('content_items').insert(items).select(), 'insert content_items');
  console.log(`✓ ${inserted.length} content_items`);

  console.log('Seeding UGC slots…');
  const ugc = must(
    await db
      .from('ugc_slots')
      .insert([
        { client_id: byName.Marefuori.id, date: '2026-09-05', brief: 'Unboxing in giardino', creator: '@sara.dv', ugc_stato: 'approvato' },
        { client_id: byName.Marefuori.id, date: '2026-09-20', brief: 'Aperitivo in terrazza, luce naturale', creator: '@ilmarco', ugc_stato: 'raccolto' },
      ])
      .select(),
    'insert ugc_slots'
  );
  console.log(`✓ ${ugc.length} ugc_slots`);

  console.log('Seeding one mock Meta connection + pages…');
  const conn = must(
    await db
      .from('meta_connections')
      .insert({
        meta_account_id: 'mock-meta-account-1',
        account_name: 'Akash Ideology',
        business_name: 'Ideology Creative Studio',
        expires_at: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      })
      .select()
      .single(),
    'insert meta_connections'
  );
  const pages = must(
    await db
      .from('meta_pages')
      .insert([
        { connection_id: conn.id, page_id: 'pg_marefuori', name: 'Marefuori Ragusa', category: 'Ristorante di pesce', ig_user_id: 'ig_marefuori', ig_username: 'marefuori.ragusa', ig_account_type: 'BUSINESS' },
        { connection_id: conn.id, page_id: 'pg_terrarossa', name: 'Terrarossa Vini', category: 'Enoteca', ig_user_id: 'ig_terrarossa', ig_username: 'terrarossa', ig_account_type: 'BUSINESS' },
      ])
      .select(),
    'insert meta_pages'
  );
  console.log(`✓ ${pages.length} meta_pages`);

  await db.from('accounts').update({ meta_connection_id: conn.id, meta_page_id: 'pg_marefuori', meta_ig_user_id: 'ig_marefuori' }).eq('id', mfIg.id);

  console.log('Creating login accounts…');

  const studioEmail = process.env.SEED_STUDIO_EMAIL;
  const studioPassword = process.env.SEED_STUDIO_PASSWORD;
  if (studioEmail && studioPassword) {
    const { error } = await db.auth.admin.createUser({
      email: studioEmail, password: studioPassword, email_confirm: true,
      user_metadata: { kind: 'studio', name: 'Studio' },
    });
    if (error) console.error('✗ studio user:', error.message);
    else console.log(`✓ studio login: ${studioEmail}`);
  } else {
    console.log('… skipped studio login (set SEED_STUDIO_EMAIL / SEED_STUDIO_PASSWORD to create one)');
  }

  const clientEmail = process.env.SEED_CLIENT_EMAIL;
  const clientPassword = process.env.SEED_CLIENT_PASSWORD;
  if (clientEmail && clientPassword) {
    const { error } = await db.auth.admin.createUser({
      email: clientEmail, password: clientPassword, email_confirm: true,
      user_metadata: { kind: 'client', client_id: byName.Marefuori.id, name: 'Giulia Ancona' },
    });
    if (error) console.error('✗ client user:', error.message);
    else console.log(`✓ client login (Marefuori): ${clientEmail}`);
  } else {
    console.log('… skipped client login (set SEED_CLIENT_EMAIL / SEED_CLIENT_PASSWORD to create one)');
  }

  console.log('\nDone.');
}

main();
