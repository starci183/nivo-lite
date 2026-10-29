import { sql } from "@modules/platform/database"

/** Lets the local role creator enter the backend role for one rolled-back proof transaction. */
export const ENTER_BACKEND_ROLE = sql`GRANT app_be TO CURRENT_USER WITH INHERIT FALSE, SET TRUE`

/** Applies the application's actual grants and RLS policies to the proof. */
export const USE_BACKEND_ROLE = sql`SET LOCAL ROLE app_be`

/** Confirms that the proof executes as the dedicated backend principal. */
export const BACKEND_ROLE = sql`SELECT current_user AS role`
