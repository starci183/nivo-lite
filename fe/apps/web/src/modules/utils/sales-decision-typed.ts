import type { TypedDecisionValues } from "@/modules/types"

/** Nothing typed yet. */
export const EMPTY_TYPED: TypedDecisionValues = { editing: {}, drafts: {}, amounts: {}, values: {} }

/** The key of a missing field of one decision. */
export const fieldKey = (id: string, name: string): string => `${id}:${name}`
