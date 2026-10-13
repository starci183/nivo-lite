import type { ContentMediaRef } from "@modules/domain/content-items"
import { isPlanChannel } from "./content-ai-planning.policy"
import type { PlanEvent, PlanPillar, PlannedSlot } from "./content-ai-planning.policy"
import { isJsonObject } from "./content-ai-prompt.policy"
import type { BrandContext, ChannelWarning, ClaimWarning } from "./content-ai-prompt.policy"

/** Reads metadata as an object, using an empty object for a missing or malformed value. */
export const objectOf = (value: unknown): Record<string, unknown> => (isJsonObject(value) ? value : {})

/** Reads the generation ids participating in a queued content operation. */
export const idsOf = (context: Record<string, unknown>): Array<string> =>
    Array.isArray(context.generationIds)
        ? context.generationIds.filter((value: unknown): value is string => typeof value === "string")
        : []

/** Reads a finite metadata number, or null when the value is absent or invalid. */
export const numeric = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null

const isStringList = (value: unknown): value is Array<string> =>
    Array.isArray(value) && value.every((item: unknown) => typeof item === "string")

/** Validates the complete public brand context before using stored generation metadata. */
export const isBrandContext = (value: unknown): value is BrandContext =>
    isJsonObject(value) &&
    typeof value.shop === "string" &&
    typeof value.knowledge === "string" &&
    typeof value.voice === "string" &&
    typeof value.avoid === "string" &&
    typeof value.audience === "string" &&
    typeof value.cta === "string" &&
    isStringList(value.sources) &&
    isStringList(value.brandHashtags)

/** Validates an attachment retained in generation metadata, including optional storage fields. */
export const isContentMediaRef = (value: unknown): value is ContentMediaRef =>
    isJsonObject(value) &&
    typeof value.kind === "string" &&
    typeof value.name === "string" &&
    (value.path === undefined || typeof value.path === "string") &&
    (value.id === undefined || typeof value.id === "string") &&
    (value.suggested === undefined || typeof value.suggested === "boolean")

const isPlanPillar = (value: unknown): value is PlanPillar =>
    isJsonObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    numeric(value.weight) !== null &&
    typeof value.active === "boolean"

const isPlanEvent = (value: unknown): value is PlanEvent =>
    isJsonObject(value) &&
    typeof value.key === "string" &&
    typeof value.date === "string" &&
    typeof value.name === "string" &&
    typeof value.angle === "string" &&
    (value.leadDays === undefined || numeric(value.leadDays) !== null)

/** Validates the deterministic schedule and theme of a stored monthly-plan slot. */
export const isPlannedSlot = (value: unknown): value is PlannedSlot =>
    isJsonObject(value) &&
    numeric(value.n) !== null &&
    typeof value.at === "string" &&
    Array.isArray(value.channels) &&
    value.channels.every(isPlanChannel) &&
    isPlanPillar(value.pillar) &&
    (value.holiday === null || isPlanEvent(value.holiday))

const isClaimWarning = (value: unknown): value is ClaimWarning => {
    if (!isJsonObject(value)) return false
    if (value.kind === "promise") return typeof value.phrase === "string"
    if (value.kind === "figure") return typeof value.figure === "string"
    return value.kind === "length" && numeric(value.length) !== null && numeric(value.max) !== null
}

/** Validates a channel-attributed claim or length finding read from stored generation results. */
export const isChannelWarning = (value: unknown): value is ChannelWarning =>
    isJsonObject(value) && isPlanChannel(value.channel) && isClaimWarning(value.warning)
