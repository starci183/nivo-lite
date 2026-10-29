import { isRecord } from "@modules/platform/primitives"
import type { PostedMessage } from "./messages.contracts"
import type { PostedCard } from "./office-cards.contracts"

const isNullableText = (value: unknown): boolean => value === null || typeof value === "string"

const isPostedCard = (value: unknown): value is PostedCard =>
    isRecord(value) && typeof value.id === "string" && isNullableText(value.room)

const isPostedMessage = (value: unknown): value is PostedMessage =>
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.author_kind === "string" &&
    typeof value.author_name === "string" &&
    typeof value.body === "string" &&
    typeof value.created_at === "string" &&
    isNullableText(value.author_user_id) &&
    isNullableText(value.agent_id) &&
    isNullableText(value.staff_id) &&
    isNullableText(value.lead_id) &&
    isNullableText(value.work_item_id) &&
    isNullableText(value.room)

/** The stored card line a RETURNING answered, or undefined when the answer holds none. */
export const postedCardOf = (raw: unknown): PostedCard | undefined =>
    Array.isArray(raw) ? raw.find(isPostedCard) : undefined

/** The stored Office line a RETURNING answered, or undefined when the answer holds none. */
export const postedMessageOf = (raw: unknown): PostedMessage | undefined =>
    Array.isArray(raw) ? raw.find(isPostedMessage) : undefined
