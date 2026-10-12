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
