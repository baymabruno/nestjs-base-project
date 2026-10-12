// Configures the development Metabase (./setup.sh metabase): the admin user,
// the read-only connection to the database and the "Dota Metrics" dashboard.
// It can run again: what already exists is kept, including dashboards edited
// in Metabase.
//
// Runs inside the app container, which reaches Metabase through the compose
// network. Settings come from the environment (see setup.sh).

const {
  METABASE_URL = 'http://metabase:3000',
  METABASE_ADMIN_EMAIL,
  METABASE_ADMIN_PASSWORD,
  METABASE_READER_PASSWORD,
  POSTGRES_DB,
} = process.env;

const DATABASE_NAME = 'Dota Metrics';
const DASHBOARD_NAME = 'Dota Metrics';

let session;

async function api(method, path, body) {
  const response = await fetch(`${METABASE_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session && { 'X-Metabase-Session': session }),
    },
    body: body && JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path}: ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function waitUntilHealthy() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const health = await api('GET', '/health');
      if (health?.status === 'ok') return;
    } catch {
      // still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('Metabase did not start');
}

/** Creates the admin on the first run; logs in on the next ones */
async function authenticate() {
  const properties = await api('GET', '/session/properties');
  if (!properties['has-user-setup']) {
    const result = await api('POST', '/setup', {
      token: properties['setup-token'],
      user: {
        first_name: 'Admin',
        last_name: 'Dota Metrics',
        email: METABASE_ADMIN_EMAIL,
        password: METABASE_ADMIN_PASSWORD,
        site_name: 'Dota Metrics',
      },
      prefs: {
        site_name: 'Dota Metrics',
        site_locale: 'pt_BR',
        allow_tracking: false,
      },
    });
    session = result.id;
    console.log('Admin user created');
    return;
  }
  const result = await api('POST', '/session', {
    username: METABASE_ADMIN_EMAIL,
    password: METABASE_ADMIN_PASSWORD,
  });
  session = result.id;
}

/** Connection to the application database with the read-only user */
async function ensureDatabase() {
  const details = {
    host: 'postgres',
    port: 5432,
    dbname: POSTGRES_DB,
    user: 'metabase_reader',
    password: METABASE_READER_PASSWORD,
    ssl: false,
  };
  const { data } = await api('GET', '/database');
  const existing = data.find((database) => database.name === DATABASE_NAME);
  if (existing) {
    // keeps the password in sync with .env
    await api('PUT', `/database/${existing.id}`, { details });
    return existing.id;
  }
  const created = await api('POST', '/database', {
    engine: 'postgres',
    name: DATABASE_NAME,
    details,
  });
  console.log('Database connection created');
  return created.id;
}

// ---- dashboard ----

const heroStats = `
  SELECT h.localized_name AS heroi,
    sum(s.matches) AS partidas,
    sum(s.wins) AS vitorias,
    round(100.0 * sum(s.wins) / sum(s.matches), 1) AS win_rate,
    round(100.0 * sum(s.matches) / (SELECT sum(matches) / 10.0 FROM hero_stats), 1) AS pick_rate
  FROM hero_stats s
  JOIN heroes h ON h.id = s.hero_id`;

const cards = [
  {
    name: 'Patch atual',
    display: 'scalar',
    query: `SELECT p.name AS patch
FROM hero_stats s JOIN patches p ON p.id = s.patch_id
LIMIT 1`,
    layout: { row: 0, col: 0, size_x: 6, size_y: 3 },
  },
  {
    name: 'Partidas no banco',
    display: 'scalar',
    query: 'SELECT count(*) AS partidas FROM matches',
    layout: { row: 0, col: 6, size_x: 6, size_y: 3 },
  },
  {
    name: 'Partidas nas últimas 24 horas',
    display: 'scalar',
    query: `SELECT count(*) AS partidas FROM matches
WHERE start_time > now() - interval '24 hours'`,
    layout: { row: 0, col: 12, size_x: 6, size_y: 3 },
  },
  {
    name: 'Estatísticas atualizadas em',
    display: 'scalar',
    query: 'SELECT max(updated_at) AS atualizado_em FROM hero_stats',
    layout: { row: 0, col: 18, size_x: 6, size_y: 3 },
  },
  {
    name: 'Partidas por dia',
    display: 'bar',
    query: `SELECT date_trunc('day', start_time)::date AS dia,
  CASE source WHEN 'PRO' THEN 'Profissional' ELSE 'Pública' END AS fonte,
  count(*) AS partidas
FROM matches
GROUP BY 1, 2
ORDER BY 1`,
    visualization: {
      'graph.dimensions': ['dia', 'fonte'],
      'graph.metrics': ['partidas'],
      'stackable.stack_type': 'stacked',
    },
    layout: { row: 3, col: 0, size_x: 16, size_y: 6 },
  },
  {
    name: 'Coleta dos detalhes',
    display: 'table',
    query: `SELECT CASE source WHEN 'PRO' THEN 'Profissional' ELSE 'Pública' END AS fonte,
  CASE details_status
    WHEN 'PENDING' THEN 'Aguardando'
    WHEN 'FETCHED' THEN 'Só itens finais'
    WHEN 'PARSED' THEN 'Com ordem de compra'
    ELSE 'Falhou'
  END AS status,
  count(*) AS partidas
FROM matches
GROUP BY 1, 2
ORDER BY 1, 2`,
    layout: { row: 3, col: 16, size_x: 8, size_y: 6 },
  },
  {
    name: 'Maiores win rates (mínimo de 10 partidas)',
    display: 'row',
    query: `${heroStats}
GROUP BY h.localized_name
HAVING sum(s.matches) >= 10
ORDER BY win_rate DESC
LIMIT 15`,
    visualization: {
      'graph.dimensions': ['heroi'],
      'graph.metrics': ['win_rate'],
    },
    layout: { row: 9, col: 0, size_x: 12, size_y: 10 },
  },
  {
    name: 'Heróis mais escolhidos',
    display: 'row',
    query: `${heroStats}
GROUP BY h.localized_name
ORDER BY pick_rate DESC
LIMIT 15`,
    visualization: {
      'graph.dimensions': ['heroi'],
      'graph.metrics': ['pick_rate'],
    },
    layout: { row: 9, col: 12, size_x: 12, size_y: 10 },
  },
  {
    name: 'Heróis do patch atual',
    display: 'table',
    query: `${heroStats}
GROUP BY h.localized_name
ORDER BY partidas DESC`,
    layout: { row: 19, col: 0, size_x: 12, size_y: 10 },
  },
  {
    name: 'Itens por herói (custo a partir de 1000)',
    display: 'table',
    query: `SELECT h.localized_name AS heroi,
  i.display_name AS item,
  sum(x.matches) AS partidas,
  round(100.0 * sum(x.wins) / sum(x.matches), 1) AS win_rate,
  round(sum(x.purchase_time_sum) / nullif(sum(x.purchase_time_count), 0) / 60.0, 1)
    AS minuto_medio_compra
FROM hero_item_stats x
JOIN heroes h ON h.id = x.hero_id
JOIN items i ON i.id = x.item_id
WHERE i.cost >= 1000
GROUP BY 1, 2
HAVING sum(x.matches) >= 3
ORDER BY 1, 3 DESC`,
    layout: { row: 19, col: 12, size_x: 12, size_y: 10 },
  },
];

async function ensureDashboard(databaseId) {
  const dashboards = await api('GET', '/dashboard');
  if (dashboards.some((dashboard) => dashboard.name === DASHBOARD_NAME)) {
    return false;
  }

  const dashboard = await api('POST', '/dashboard', {
    name: DASHBOARD_NAME,
    description: 'Coleta de partidas e estatísticas do meta (patch atual)',
  });

  const dashcards = [];
  for (const [index, card] of cards.entries()) {
    const created = await api('POST', '/card', {
      name: card.name,
      display: card.display,
      dataset_query: {
        type: 'native',
        database: databaseId,
        native: { query: card.query.trim() },
      },
      visualization_settings: card.visualization ?? {},
    });
    dashcards.push({ id: -(index + 1), card_id: created.id, ...card.layout });
  }
  await api('PUT', `/dashboard/${dashboard.id}`, { dashcards });
  return true;
}

await waitUntilHealthy();
await authenticate();
const databaseId = await ensureDatabase();
if (await ensureDashboard(databaseId)) {
  console.log(`Dashboard "${DASHBOARD_NAME}" created`);
}
