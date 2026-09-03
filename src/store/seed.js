/*
 * IDEOLOGY STUDIO — demo data
 *
 * Runs once, only when the store is completely empty, so a fresh open shows a
 * working tool instead of an empty shell. Wiping the store from Impostazioni
 * re-seeds on the next load.
 *
 * The clients here are invented. None of the real client names, projects or
 * task history that were hard-coded into the source tool's plan.js are carried
 * over — that was production data sitting in source control, and copying it
 * into a new repo would have spread the problem rather than left it behind.
 * These are plausible stand-ins for the kind of account Ideology actually runs:
 * food, wine, design and beauty brands out of Ragusa and Milano.
 *
 * Images come from picsum.photos with fixed seeds, so the same post always
 * shows the same photo across reloads and the feed grid stays visually stable
 * while you drag things around. They need network; the grid degrades to a
 * branded placeholder tile when offline (see .feed-img fallback in the page).
 */

window.IdeologySeed = (function () {
  'use strict';

  const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

  /* Seeded PRNG — demo content must be identical on every load, otherwise the
     feed reshuffles under you between refreshes and nothing looks trustworthy. */
  function rng(seed) {
    let s = 0;
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  function img(seed, w, h) {
    return 'https://picsum.photos/seed/' + encodeURIComponent(seed) + '/' + w + '/' + h;
  }

  function id(prefix) {
    return prefix + Math.random().toString(36).slice(2, 9);
  }

  /* ── Clients ─────────────────────────────────────────────────────────────
     shareToken is what the client portal is addressed by (/client/?t=...).
     Fixed here rather than random so the demo portal links in the README keep
     working across a reset. */
  const CLIENTS = [
    {
      id: 'c_marefuori', name: 'Marefuori', slug: 'marefuori',
      color: '#2DA7A7', shareToken: 'mf7c21a8b309',
      tipo: 'retainer', status: 'Attivo', pkg: 'Professional',
      pkgHours: 22, revenue: 1200,
      referente: { nome: 'Giulia Ancona', email: 'giulia@marefuori.it', tel: '+39 0932 110 220' },
      note: 'Ristorante di pesce, Marina di Ragusa. Stagionalità forte: da maggio a settembre il feed spinge terrazza e pescato del giorno.',
      accounts: [
        { id: 'a_mf_ig', platform: 'Instagram', handle: '@marefuori.ragusa' },
        { id: 'a_mf_fb', platform: 'Facebook',  handle: 'Marefuori' },
      ],
    },
    {
      id: 'c_terrarossa', name: 'Terrarossa', slug: 'terrarossa',
      color: '#e40e49', shareToken: 'tr4e90d17c62',
      tipo: 'retainer', status: 'Attivo', pkg: 'Essential',
      pkgHours: 14, revenue: 800,
      referente: { nome: 'Salvo Di Grazia', email: 'salvo@terrarossa.wine', tel: '+39 0932 445 118' },
      note: 'Cantina naturale, Vittoria. Tono sobrio, niente emoji. Focus vendemmia e fiere di settore.',
      accounts: [
        { id: 'a_tr_ig', platform: 'Instagram', handle: '@terrarossa.wine' },
      ],
    },
    {
      id: 'c_vulcano', name: 'Vulcano Lab', slug: 'vulcano-lab',
      color: '#F2C700', shareToken: 'vl2b83f45a10',
      tipo: 'retainer', status: 'Attivo', pkg: 'Professional',
      pkgHours: 28, revenue: 1850,
      referente: { nome: 'Chiara Neri', email: 'chiara@vulcanolab.com', tel: '+39 02 8342 9910' },
      note: 'Skincare a base di ossidiana, sede Milano. Lancio linea corpo in ottobre — feed da tenere libero dal 12.',
      accounts: [
        { id: 'a_vl_ig', platform: 'Instagram', handle: '@vulcanolab' },
        { id: 'a_vl_tk', platform: 'TikTok',    handle: '@vulcanolab' },
      ],
    },
    {
      id: 'c_nodo', name: 'Nodo Studio', slug: 'nodo-studio',
      color: '#f37c7b', shareToken: 'nd5a12c88e47',
      /* Architecture studio, "molto curata" -- the one seeded client whose
         own work reads better on white than on the same black every other
         portal uses. Demonstrates the per-client theme out of the box
         instead of leaving it a feature nobody notices until they dig for
         it in Clienti. */
      theme: 'light',
      tipo: 'oneshot', status: 'Attivo', pkg: 'Starter',
      pkgHours: 10, budget: 3500, progettoNome: 'Rebrand + sito', progettoDeadline: '2026-12-18',
      referente: { nome: 'Marco Failla', email: 'marco@nodostudio.it', tel: '+39 0932 778 401' },
      note: 'Studio di architettura. Solo LinkedIn e Instagram, cadenza bassa, molto curata.',
      accounts: [
        { id: 'a_nd_ig', platform: 'Instagram', handle: '@nodo.studio' },
        { id: 'a_nd_li', platform: 'LinkedIn',  handle: 'Nodo Studio' },
      ],
    },
    {
      id: 'c_kalat', name: 'Kalát', slug: 'kalat',
      color: '#00AFAF', shareToken: 'kl9f67b23d54',
      tipo: 'retainer', status: 'Attivo', pkg: 'Starter',
      pkgHours: 8,  revenue: 450,
      referente: { nome: 'Rosa Cilia', email: 'rosa@kalat.bakery', tel: '+39 0932 903 776' },
      note: 'Panificio artigianale, Scicli. Contenuti molto materici: impasti, forno, mani.',
      accounts: [
        { id: 'a_kl_ig', platform: 'Instagram', handle: '@kalat.bakery' },
      ],
    },
  ];

  /* ── Content pillars, per client ──────────────────────────────────────── */
  const PILLARS = {
    c_marefuori: [
      { id: 'p_mf1', name: 'Pescato del giorno', color: '#2DA7A7' },
      { id: 'p_mf2', name: 'Terrazza & atmosfera', color: '#F2C700' },
      { id: 'p_mf3', name: 'Dietro le quinte',    color: '#f37c7b' },
      { id: 'p_mf4', name: 'Recensioni',          color: '#a3a3a3' },
    ],
    c_terrarossa: [
      { id: 'p_tr1', name: 'Vigna',        color: '#e40e49' },
      { id: 'p_tr2', name: 'Cantina',      color: '#F2C700' },
      { id: 'p_tr3', name: 'Abbinamenti',  color: '#2DA7A7' },
    ],
    c_vulcano: [
      { id: 'p_vl1', name: 'Prodotto',     color: '#F2C700' },
      { id: 'p_vl2', name: 'Ingredienti',  color: '#2DA7A7' },
      { id: 'p_vl3', name: 'Rituale',      color: '#f37c7b' },
      { id: 'p_vl4', name: 'UGC',          color: '#e40e49' },
    ],
    c_nodo: [
      { id: 'p_nd1', name: 'Progetti',   color: '#f37c7b' },
      { id: 'p_nd2', name: 'Processo',   color: '#F2C700' },
      { id: 'p_nd3', name: 'Materiali',  color: '#a3a3a3' },
    ],
    c_kalat: [
      { id: 'p_kl1', name: 'Impasti',    color: '#00AFAF' },
      { id: 'p_kl2', name: 'Forno',      color: '#F2C700' },
      { id: 'p_kl3', name: 'Persone',    color: '#f37c7b' },
    ],
  };

  const FORMATS = {
    c_marefuori: [
      { id: 'f_mf1', name: 'Foto singola', ratio: '4/5' },
      { id: 'f_mf2', name: 'Carosello',    ratio: '4/5' },
      { id: 'f_mf3', name: 'Reel',         ratio: '9/16' },
    ],
    c_terrarossa: [
      { id: 'f_tr1', name: 'Foto singola', ratio: '4/5' },
      { id: 'f_tr2', name: 'Carosello',    ratio: '4/5' },
    ],
    c_vulcano: [
      { id: 'f_vl1', name: 'Packshot',  ratio: '4/5' },
      { id: 'f_vl2', name: 'Carosello', ratio: '4/5' },
      { id: 'f_vl3', name: 'Reel',      ratio: '9/16' },
    ],
    c_nodo: [
      { id: 'f_nd1', name: 'Foto singola', ratio: '4/5' },
      { id: 'f_nd2', name: 'Carosello',    ratio: '4/5' },
    ],
    c_kalat: [
      { id: 'f_kl1', name: 'Foto singola', ratio: '4/5' },
      { id: 'f_kl2', name: 'Reel',         ratio: '9/16' },
    ],
  };

  /* ── Caption copy ──────────────────────────────────────────────────────
     Written per client so the tone difference between accounts is visible in
     the feed — that is most of what a content planner is actually judged on. */
  const COPY = {
    c_marefuori: [
      'Il pescato di stamattina. Ricciola, gambero rosso, totani.\nDa mercoledì in carta.',
      'La terrazza alle 19:40. Non serve altro.',
      'Tre modi di cucinare il gambero rosso di Mazara — swipe.',
      'Cucina aperta fino a mezzanotte per tutto settembre.',
      'Grazie a chi ha scritto questa settimana. Ci vediamo sabato.',
      'Nuovo antipasto: sgombro marinato, finocchietto, agrumi.',
      'Il tonno arriva intero. Lo sfilettiamo qui, ogni mattina.',
      'Weekend pieno — restano due tavoli per domenica pranzo.',
      'Non è un tramonto qualsiasi, è quello di fine stagione.',
      'Ricetta della casa: spaghetti, ricci, nient\'altro.',
    ],
    c_terrarossa: [
      'Vendemmia 2026. Iniziata il 4 settembre, in anticipo di dieci giorni.',
      'Frappato, otto mesi in acciaio. Nessun filtro, nessuna correzione.',
      'La terra qui è rossa per il ferro. Da lì il nome.',
      'Saremo a Milano il 18 e 19 per Vinitaly Special Edition.',
      'Cosa succede in cantina a settembre — le foto di questa settimana.',
      'Nero d\'Avola 2024: ultime bottiglie.',
      'Abbinamento della settimana: Cerasuolo e tonno alla stemperata.',
      'Diradamento manuale. Restano cinque grappoli per pianta.',
    ],
    c_vulcano: [
      'Nuova texture. Stessa formula.',
      'L\'ossidiana è vetro vulcanico. La maciniamo a 12 micron.',
      'Il rituale serale in quattro passaggi — swipe.',
      'Dal 12 ottobre. Segnatevelo.',
      'Cosa c\'è dentro, per davvero: INCI completo in caption.',
      'Prima e dopo, 28 giorni, nessun ritocco.',
      'La nostra crema corpo nasce da uno scarto di cava.',
      'Testato su 40 persone in Sicilia. Non su animali.',
      'Domande frequenti sulla nuova linea — rispondiamo qui.',
      'Confezione ricaricabile. Il vetro resta, cambia solo il refill.',
    ],
    c_nodo: [
      'Casa a Punta Secca. Consegna primavera 2026.',
      'Il calcestruzzo lasciato grezzo invecchia meglio di qualsiasi finitura.',
      'Sezione longitudinale. Il vuoto centrale porta luce a tutti i livelli.',
      'Cantiere, settimana 36.',
      'Materiali di progetto: pietra pece, rovere, ferro ossidato.',
      'Ristrutturazione in centro storico a Ragusa Ibla — prima fase conclusa.',
    ],
    c_kalat: [
      'Lievito madre, 1998. Più vecchio di metà dello staff.',
      'Impasto a 24 ore. Non si accorcia.',
      'Il forno arriva a 280°. Il pane entra a 250°.',
      'Nuovo: pane ai grani antichi siciliani, solo il sabato.',
      'Le mani di Rosa. Trent\'anni di questo mestiere.',
      'Alle 6:40 il primo sfornato è già fuori.',
      'Farina di tumminia, macinata a pietra a 20 km da qui.',
    ],
  };

  const NOTES = [
    '', '', '', '',
    'Attenzione al crop: il logo in basso a destra si taglia su 4:5.',
    'Chiedere al cliente il permesso per il volto in seconda slide.',
    'Da pubblicare dopo le 18, mai la mattina.',
    'Verificare disponibilità prodotto prima di uscire.',
  ];

  /* Distribution of approval states across the demo feed. Weighted so the
     board looks like real work in progress — mostly approved in the past,
     a cluster awaiting the client now, a few drafts ahead. */
  function statoFor(dayIndex, total, rand) {
    const progress = dayIndex / total;
    const r = rand();
    /* The oldest slice of the month has already gone out — otherwise the
       'Pubblicato' column is permanently empty in the demo and the last stage
       of the pipeline looks broken. */
    if (progress < 0.2)  return r < 0.75 ? 'pubblicato' : 'approvato';
    if (progress < 0.45) return r < 0.9 ? 'approvato' : 'approvare';
    if (progress < 0.7)  return r < 0.5 ? 'approvare' : (r < 0.75 ? 'revisione' : 'approvato');
    return r < 0.65 ? 'bozza' : 'approvare';
  }

  function buildFeed(client, account, month, year) {
    const rand    = rng(client.id + account.id + month + year);
    const monthIx = MONTHS.indexOf(month);
    const copyPool = COPY[client.id] || [''];
    const pillars  = PILLARS[client.id] || [];
    const formats  = FORMATS[client.id] || [];

    // Posting cadence by package — a Starter client genuinely posts less, and
    // the feed should show that rather than every client looking identical.
    const perMonth = client.pkg === 'Professional' ? 12
                   : client.pkg === 'Essential'    ? 8
                   : 5;

    const daysInMonth = new Date(year, monthIx + 1, 0).getDate();
    const step = Math.floor(daysInMonth / perMonth);

    const items = [];
    for (let i = 0; i < perMonth; i++) {
      const day = Math.min(daysInMonth, 2 + i * step + Math.floor(rand() * 2));
      const r = rand();
      const type = r < 0.62 ? 'photo' : (r < 0.88 ? 'carousel' : 'reel');
      const seed = client.id + '-' + account.id + '-' + month + '-' + i;
      const isVertical = type === 'reel';
      const w = 600, h = isVertical ? 1066 : 750;

      const item = {
        id:       id('i_'),
        type,
        url:         img(seed, w, h),
        externalUrl: img(seed, w, h),
        date:     year + '-' + String(monthIx + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
        copy:     copyPool[i % copyPool.length],
        note:     NOTES[Math.floor(rand() * NOTES.length)],
        pilastro: pillars.length ? pillars[Math.floor(rand() * pillars.length)].name : '',
        formato:  type === 'carousel' ? 'Carosello' : type === 'reel' ? 'Reel'
                  : (formats.length ? formats[0].name : 'Foto singola'),
        apprStato: statoFor(i, perMonth, rand),
        apprRevisions: 0,
        /* Roughly one in six posts is paid. Enough that the calendar has
           something to make loud, few enough that it still reads as an
           exception rather than the norm. */
        sponsored: rand() < 0.17,
        /* Reels get a real clip so the portal's player is demonstrable.
           Vendored locally rather than hotlinked, so the demo works offline.
           It is a 16:9 source in a 9:16 format on purpose — see the note in
           the portal about letterboxing telling you the asset does not match
           the placement. */
        videoUrl: type === 'reel' ? '/assets/video/demo-reel.mp4' : '',
      };

      if (type === 'carousel') {
        const n = 3 + Math.floor(rand() * 3);
        item.slides = Array.from({ length: n }, (_, s) => ({
          url:         img(seed + '-s' + s, w, h),
          externalUrl: img(seed + '-s' + s, w, h),
          videoUrl:    '',
          name:        'slide-' + (s + 1) + '.jpg',
          copy:        s === 0 ? '' : 'Passaggio ' + s,
          note:        '',
        }));
        /* One carousel in six mixes in a clip on its second slide, so the
           mixed-media path (poster until opened, then plays) is something
           you can actually click through in the demo, not just read about. */
        if (rand() < 0.16 && item.slides[1]) {
          item.slides[1].videoUrl = '/assets/video/demo-reel.mp4';
        }
        item.url = item.slides[0].url;
        item.externalUrl = item.slides[0].url;
      }

      // A couple of items carry real client feedback so the revision UI and the
      // portal's note thread have something to show without hand-editing.
      if (item.apprStato === 'revisione') {
        item.clientNote = rand() < 0.5
          ? 'Possiamo cambiare la foto? Questa l\'abbiamo già usata a luglio.'
          : 'Testo ok, ma togliamo il riferimento al prezzo per favore.';
        item.clientName = client.referente.nome.split(' ')[0];
        item.apprRevisions = 1;
      }

      items.push(item);
    }

    // Newest first, matching how the grid is built everywhere else in the app.
    return items.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  function buildStories(client, account, month, year) {
    const rand    = rng('st' + client.id + account.id + month);
    const monthIx = MONTHS.indexOf(month);
    const n = 4 + Math.floor(rand() * 4);
    return Array.from({ length: n }, (_, i) => {
      const seed = 'st-' + client.id + '-' + month + '-' + i;
      const day  = 2 + Math.floor(rand() * 26);
      return {
        id:   id('s_'),
        type: 'photo',
        url:         img(seed, 540, 960),
        externalUrl: img(seed, 540, 960),
        date: year + '-' + String(monthIx + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
        copy: '',
        note: '',
        apprStato: rand() < 0.6 ? 'approvato' : 'bozza',
      };
    });
  }

  /* ── UGC / PED plans ───────────────────────────────────────────────────
     Only for the two clients that would realistically run creator content. */
  function buildPed(client, month, year) {
    const rand = rng('ped' + client.id + month);
    const monthIx = MONTHS.indexOf(month);
    const STATI = ['raccolto', 'selezionato', 'adattato', 'approvato', 'autonoma'];
    const BRIEFS = [
      'Unboxing in luce naturale, 15s',
      'Routine serale, voce fuori campo',
      'Prima impressione, reazione sincera',
      'Prodotto in uso, mani in primo piano',
      'Recensione parlata, 30s',
      'Comparativa con prodotto precedente',
    ];
    const n = 5 + Math.floor(rand() * 3);
    return {
      slots: Array.from({ length: n }, (_, i) => ({
        id:    id('u_'),
        date:  year + '-' + String(monthIx + 1).padStart(2, '0') + '-' + String(3 + i * 4).padStart(2, '0'),
        brief: BRIEFS[i % BRIEFS.length],
        type:  'UGC',
        ugcStato: STATI[Math.floor(rand() * STATI.length)],
        creator:  ['@sara.dv', '@ilmarco', '@giada.cs', '@nino_p'][Math.floor(rand() * 4)],
      })),
    };
  }

  /* ── Entry point ───────────────────────────────────────────────────────── */
  function run(store) {
    const now      = new Date();
    const year     = now.getFullYear();
    const thisMonth = MONTHS[now.getMonth()];
    const nextMonth = MONTHS[(now.getMonth() + 1) % 12];
    const prevMonth = MONTHS[(now.getMonth() + 11) % 12];
    const nextYear  = now.getMonth() === 11 ? year + 1 : year;
    const prevYear  = now.getMonth() === 0  ? year - 1 : year;

    const feeds   = {};
    const stories = {};
    const ped     = {};
    const pillars = {};
    const formats = {};

    CLIENTS.forEach(client => {
      pillars[client.id] = PILLARS[client.id] || [];
      formats[client.id] = FORMATS[client.id] || [];

      client.accounts.forEach(acc => {
        [[prevMonth, prevYear], [thisMonth, year], [nextMonth, nextYear]].forEach(([m, y]) => {
          const label = m + ' ' + y;
          feeds[store.feedKey(acc.id, label)] = buildFeed(client, acc, m, y);
          if (acc.platform === 'Instagram') {
            stories[store.feedKey(acc.id, label)] = buildStories(client, acc, m, y);
          }
        });
      });

      if (client.id === 'c_vulcano' || client.id === 'c_marefuori') {
        ped[client.id] = {
          [thisMonth + ' ' + year]: buildPed(client, thisMonth, year),
          [nextMonth + ' ' + nextYear]: buildPed(client, nextMonth, nextYear),
        };
      }
    });

    store.set('clients',  structuredClone(CLIENTS));
    store.set('feeds',    feeds);
    store.set('stories',  stories);
    store.set('pedPlans', ped);
    store.set('pillars',  pillars);
    store.set('formats',  formats);
    store.set('settings', {
      theme: 'dark',
      seededAt: new Date().toISOString(),
    });

    console.log('[seed] Ideology demo data loaded —',
      CLIENTS.length, 'clienti,',
      Object.keys(feeds).length, 'feed,',
      Object.values(feeds).reduce((n, a) => n + a.length, 0), 'post.');
  }

  return { run, CLIENTS, MONTHS };
})();
