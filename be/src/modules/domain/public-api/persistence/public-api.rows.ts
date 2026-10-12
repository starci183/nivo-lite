import type { Database } from "../../../../../../supabase/types/database.types"

/** One generated row of public.leads. */
export type LeadsRow = Database["public"]["Tables"]["leads"]["Row"]

/** One generated row of public.events. */
export type EventsRow = Database["public"]["Tables"]["events"]["Row"]

/** One generated row of public.agent_conversations. */
export type ConversationsRow = Database["public"]["Tables"]["agent_conversations"]["Row"]

/** One generated row of public.inbound_events. */
export type InboundEventsRow = Database["public"]["Tables"]["inbound_events"]["Row"]

/** One generated row of public.knowledge_sources. */
export type KnowledgeSourcesRow = Database["public"]["Tables"]["knowledge_sources"]["Row"]
