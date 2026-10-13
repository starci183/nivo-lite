import { sql } from "@modules/platform/database"

/** The catalogue of a workspace in display order ($1 workspace). */
export const SELECT_REWARDS = sql`SELECT id, key, name, kind, value_vnd::float8 AS value_vnd, percent, points_cost, stock, per_customer_limit, min_tier_key, note, active
FROM public.loyalty_rewards
WHERE workspace_id = $1
ORDER BY sort_order, points_cost
LIMIT 200`

/** The rewards customers may redeem now, cheapest first ($1 workspace). */
export const SELECT_ACTIVE_REWARDS = sql`SELECT id, key, name, kind, value_vnd::float8 AS value_vnd, percent, points_cost, stock, per_customer_limit, min_tier_key, note, active
FROM public.loyalty_rewards
WHERE workspace_id = $1 AND active
ORDER BY sort_order, points_cost
LIMIT 200`

/** One reward by id ($1 workspace, $2 reward). */
export const SELECT_REWARD_BY_ID = sql`SELECT id, key, name, kind, value_vnd::float8 AS value_vnd, percent, points_cost, stock, per_customer_limit, min_tier_key, note, active
FROM public.loyalty_rewards
WHERE workspace_id = $1 AND id = $2
LIMIT 1`

/** One active reward by its key ($1 workspace, $2 key). */
export const SELECT_REWARD_BY_KEY = sql`SELECT id, key, name, kind, value_vnd::float8 AS value_vnd, percent, points_cost, stock, per_customer_limit, min_tier_key, note, active
FROM public.loyalty_rewards
WHERE workspace_id = $1 AND key = $2 AND active
LIMIT 1`

/** One reward by id, locked for the rest of the transaction ($1 workspace, $2 reward). */
export const LOCK_REWARD = sql`SELECT id, key, name, kind, value_vnd::float8 AS value_vnd, percent, points_cost, stock, per_customer_limit, min_tier_key, note, active
FROM public.loyalty_rewards
WHERE workspace_id = $1 AND id = $2
LIMIT 1
FOR UPDATE`

/** Takes one unit out of the stock of a reward that has a stock ($1 workspace, $2 reward). */
export const TAKE_STOCK = sql`UPDATE public.loyalty_rewards
SET stock = stock - 1
WHERE workspace_id = $1 AND id = $2 AND stock IS NOT NULL`

/** Saves an existing reward ($1 workspace, $2 id, $3 name, $4 kind, $5 value, $6 percent, $7 points, $8 stock, $9 per-customer limit, $10 minimum tier, $11 note, $12 active). */
export const UPDATE_REWARD = sql`WITH changed AS (
  UPDATE public.loyalty_rewards
  SET name = $3, kind = $4, value_vnd = $5, percent = $6, points_cost = $7, stock = $8,
      per_customer_limit = $9, min_tier_key = $10, note = $11, active = $12
  WHERE workspace_id = $1 AND id = $2
  RETURNING id, key, name, kind, value_vnd::float8 AS value_vnd, percent, points_cost, stock,
            per_customer_limit, min_tier_key, note, active
)
SELECT * FROM changed`

/** Creates a reward, leaving a key collision for a retry ($1 workspace, $2 key, $3 name, $4 kind, $5 value, $6 percent, $7 points, $8 stock, $9 limit, $10 tier, $11 note, $12 active, $13 sort order, $14 suffix). */
export const INSERT_REWARD = sql`INSERT INTO public.loyalty_rewards
  (workspace_id, key, name, kind, value_vnd, percent, points_cost, stock, per_customer_limit, min_tier_key, note, active, sort_order)
VALUES ($1, CASE WHEN $14::boolean THEN $2 || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) ELSE $2 END,
        $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
ON CONFLICT (workspace_id, key) DO NOTHING
RETURNING id, key, name, kind, value_vnd::float8 AS value_vnd, percent, points_cost, stock,
          per_customer_limit, min_tier_key, note, active`

/** Removes an entry from the active catalogue; unused entries are deleted and used ones are paused ($1 workspace, $2 reward). */
export const DELETE_REWARD = sql`WITH referenced AS MATERIALIZED (
  SELECT EXISTS (SELECT 1 FROM public.loyalty_ledger WHERE reward_id = $2) AS used
), removed AS (
  DELETE FROM public.loyalty_rewards
  WHERE workspace_id = $1 AND id = $2
    AND NOT (SELECT used FROM referenced)
  RETURNING id
), retired AS (
  UPDATE public.loyalty_rewards
  SET active = false
  WHERE workspace_id = $1 AND id = $2 AND (SELECT used FROM referenced)
  RETURNING id
)
SELECT 'deleted' AS outcome FROM removed
UNION ALL
SELECT 'retired' AS outcome FROM retired`

/** Installs missing starter rewards atomically; existing entries, including paused ones, stay as saved ($1 workspace, $2 presets). */
export const INSERT_REWARD_PRESETS = sql`INSERT INTO public.loyalty_rewards
  (workspace_id, key, name, kind, value_vnd, percent, points_cost, stock, per_customer_limit, min_tier_key, note, active, sort_order)
SELECT $1, p.key, p.name, p.kind, p.value_vnd, p.percent, p.points_cost, p.stock,
       p.per_customer_limit, p.min_tier_key, p.note, true, p.sort_order
FROM jsonb_to_recordset($2::jsonb) AS p(key text, name text, kind text, value_vnd bigint, percent int,
  points_cost int, stock int, per_customer_limit int, min_tier_key text, note text, sort_order int)
ON CONFLICT (workspace_id, key) DO NOTHING
RETURNING id`
