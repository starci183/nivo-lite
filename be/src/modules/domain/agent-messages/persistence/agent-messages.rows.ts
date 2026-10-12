import type { Database } from "../../../../../../supabase/types/database.types"

type MessageRow = Database["public"]["Tables"]["agent_messages"]["Row"]

/** The id an insert answers. */
export type MessageIdRow = Pick<MessageRow, "id">

/** A stored message as FIND_MESSAGE and FIND_AGENT_REPLY select it. */
export type StoredMessageRow = Pick<MessageRow, "id" | "body" | "delivery_status"> & { role?: MessageRow["role"] }

/** One transcript line. */
export type TranscriptRow = Pick<MessageRow, "role" | "body">

/** The time of the customer's last message. */
export type LastMessageRow = Pick<MessageRow, "created_at">
