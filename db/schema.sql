-- Esquema de Mentor IA.
--
-- Convención: columnas en snake_case acá, campos en camelCase en el dominio.
-- El mapeo vive en PostgresDataSource, del lado que sabe de SQL.
--
-- La convención de moneda del proyecto se conserva en los nombres: `_bob` para
-- bolivianos, `_usd` para dólares. Un monto sin sufijo sería un bug esperando.
--
-- Idempotente: se puede correr las veces que haga falta.

CREATE TABLE IF NOT EXISTS products (
  id               text PRIMARY KEY,
  sku              text NOT NULL,
  name             text NOT NULL,
  category         text NOT NULL DEFAULT 'general',
  -- Costo de reposición unitario en dólares.
  cost_usd         numeric(14, 4) NOT NULL DEFAULT 0,
  -- Tipo de cambio al que se compró el lote actual. Para un producto nacional
  -- es lo que fija su costo en Bs, porque no se revalúa con el dólar.
  purchase_fx_rate numeric(12, 4) NOT NULL DEFAULT 1,
  price_bob        numeric(14, 2) NOT NULL DEFAULT 0,
  stock            integer NOT NULL DEFAULT 0,
  reorder_point    integer NOT NULL DEFAULT 0,
  imported         boolean NOT NULL DEFAULT false,
  supplier         text
);

CREATE TABLE IF NOT EXISTS customers (
  id                   text PRIMARY KEY,
  name                 text NOT NULL,
  phone                text,
  segment              text NOT NULL DEFAULT 'minorista',
  first_purchase_date  date NOT NULL,
  last_purchase_date   date NOT NULL,
  total_spent_bob      numeric(14, 2) NOT NULL DEFAULT 0,
  purchase_count       integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales (
  id          text PRIMARY KEY,
  date        date NOT NULL,
  -- Se permite venta sin cliente: el mostrador no siempre lo registra.
  customer_id text REFERENCES customers(id) ON DELETE SET NULL,
  total_bob   numeric(14, 2) NOT NULL DEFAULT 0,
  channel     text NOT NULL DEFAULT 'tienda'
);

CREATE TABLE IF NOT EXISTS sale_items (
  id             bigserial PRIMARY KEY,
  sale_id        text NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  -- Sin FK a products: si se borra un producto del catálogo, la venta histórica
  -- no debe desaparecer ni bloquear el borrado.
  product_id     text NOT NULL,
  quantity       integer NOT NULL,
  unit_price_bob numeric(14, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id          text PRIMARY KEY,
  date        date NOT NULL,
  category    text NOT NULL DEFAULT 'otros',
  description text NOT NULL DEFAULT '',
  amount_bob  numeric(14, 2) NOT NULL DEFAULT 0,
  due_date    date,
  paid        boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS fx_rates (
  date    date PRIMARY KEY,
  -- Un solo tipo de cambio desde la unificación del 29/06/2026.
  rate    numeric(12, 4) NOT NULL,
  -- 'fijo' para el régimen anterior, 'flexible' para el actual. Comparar entre
  -- regímenes daría una "subida" que en realidad fue un cambio de reglas.
  regimen text NOT NULL DEFAULT 'flexible',
  source  text NOT NULL DEFAULT 'bcb'
);

-- Avance de formalización del negocio. Es estado del usuario, no catálogo legal.
CREATE TABLE IF NOT EXISTS compliance (
  item_id    text PRIMARY KEY,
  estado     text NOT NULL DEFAULT 'pendiente',
  nota       text,
  vence      date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para los accesos que realmente hace el sistema.
CREATE INDEX IF NOT EXISTS sales_date_idx        ON sales (date DESC);
CREATE INDEX IF NOT EXISTS sales_customer_idx    ON sales (customer_id);
CREATE INDEX IF NOT EXISTS sale_items_sale_idx   ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS sale_items_prod_idx   ON sale_items (product_id);
CREATE INDEX IF NOT EXISTS expenses_date_idx     ON expenses (date DESC);
CREATE INDEX IF NOT EXISTS expenses_due_idx      ON expenses (due_date) WHERE paid = false;
CREATE INDEX IF NOT EXISTS fx_rates_date_idx     ON fx_rates (date DESC);
