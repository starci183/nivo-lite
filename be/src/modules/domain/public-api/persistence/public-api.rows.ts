import type { Database } from "../../../../../../supabase/types/database.types"

/** One generated row of public.public_api, the ledger of accepted requests. */
export type PublicApiRow = Database["public"]["Tables"]["public_api"]["Row"]

/** One generated row of public.leads. */
export type LeadsRow = Database["public"]["Tables"]["leads"]["Row"]

/** One generated row of public.events. */
export type EventsRow = Database["public"]["Tables"]["events"]["Row"]

/** One generated row of public.agent_conversations. */
export type ConversationsRow = Database["public"]["Tables"]["agent_conversations"]["Row"]
