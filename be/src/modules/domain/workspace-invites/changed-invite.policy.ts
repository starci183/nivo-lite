import { isRecord } from "@modules/platform/primitives"
import type { ChangedInvite } from "./workspace-invites.contracts"

const isChangedInvite = (value: unknown): value is ChangedInvite =>
    isRecord(value) && typeof value.id === "string" && typeof value.email === "string" && typeof value.role === "string"

/** The first invitation a RETURNING write changed; undefined when it changed none. */
export const firstChangedInvite = (raw: unknown): ChangedInvite | undefined =>
    Array.isArray(raw) ? raw.find(isChangedInvite) : undefined
