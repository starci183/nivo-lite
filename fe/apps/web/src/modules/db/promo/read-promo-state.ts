import "server-only"

import { getTranslations } from "next-intl/server"
import { cache } from "react"
import { FOUNDING_OFFER } from "@/modules/promo"
import type { PromoRaw, PromoState } from "@/modules/promo"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { readActiveWorkspace } from "../workspace/read-active-workspace"
import { buildPromoState } from "./promo.mapper"

/** True when the function answered an object with the lists and flags the state is built from. */
const isPromoRaw = (value: unknown): value is PromoRaw =>
    typeof value === "object" &&
    value !== null &&
    "website_leads" in value &&
    Array.isArray(value.website_leads) &&
    "first_events" in value &&
    Array.isArray(value.first_events) &&
    "chatbot" in value &&
    "is_founding_member" in value

/** Builds the state from the raw facts of `promo_state` (also embedded in `dashboard_data`), with the labels in the reader's language. */
export const readPromoStateFrom = async (raw: PromoRaw): Promise<PromoState> => {
    const t = await getTranslations("promo")
    return buildPromoState(raw, (key) => t(key))
}

/** Promo and onboarding state of the active workspace: one function call, under the caller's RLS. */
export const readPromoState = cache(async (): Promise<DbOutcome<PromoState>> => {
    const workspace = await readActiveWorkspace()
    if (workspace.kind !== "ok") return workspace
    const client = await createServerDbClient()
    const rpc = toOutcome(
        await client.rpc("promo_state", {
            ws: workspace.value.id,
            founding_from: FOUNDING_OFFER.startsAt,
            founding_to: FOUNDING_OFFER.endsAt,
        }),
    )
    if (rpc.kind !== "ok") return rpc
    return isPromoRaw(rpc.value) ? dbOk(await readPromoStateFrom(rpc.value)) : dbFailure("invalid", "promo-state")
})

/** The promo state of the active workspace for a server page that cannot show anything without it; it throws when the state cannot be read. */
export const getPromoState = async (): Promise<PromoState> => {
    const outcome = await readPromoState()
    if (outcome.kind !== "ok") throw new Error(`promo state: ${outcome.kind}`)
    return outcome.value
}
