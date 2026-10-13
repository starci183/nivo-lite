import "server-only"

import { createServerDbClient } from "../server"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { readContentActor } from "./read-actor"
import { readContentFigures } from "./read-figures"
import { readContentCadence, readContentItems, readContentPillars, readContentSettings } from "./read-items"
import { readContentMedia } from "./read-media"
import type { ContentWorkbenchData, LastPlan } from "@/modules/content"

const readLastPlan = async (workspaceId: string): Promise<DbOutcome<LastPlan | null>> => {
    const client = await createServerDbClient()
    const row = toOutcome(
        await client
            .from("content_plans")
            .select("month, idea_count, ai_ms, created_at")
            .eq("workspace_id", workspaceId)
            .eq("status", "done")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    )
    if (row.kind === "ok") {
        return dbOk({
            month: row.value.month,
            ideas: row.value.idea_count,
            ms: row.value.ai_ms,
            createdAt: row.value.created_at,
        })
    }
    return row.kind === "not-found" ? dbOk(null) : row
}

/** Everything the content workbench shows, read with the signed-in member's own session (RLS decides what they may see). */
export const readContentWorkbench = async (): Promise<DbOutcome<ContentWorkbenchData>> => {
    const actor = await readContentActor()
    if (actor.kind !== "ok") return actor
    const ws = actor.value.workspaceId
    const [items, pillars, cadence, settings, plan, figures] = await Promise.all([
        readContentItems(ws),
        readContentPillars(ws),
        readContentCadence(ws),
        readContentSettings(ws),
        readLastPlan(ws),
        readContentFigures(ws),
    ])
    if (items.kind !== "ok") return items
    if (pillars.kind !== "ok") return pillars
    if (cadence.kind !== "ok") return cadence
    if (settings.kind !== "ok") return settings
    const media = await readContentMedia(ws, items.value)
    return dbOk({
        nowIso: new Date().toISOString(),
        workspaceId: ws,
        canManage: actor.value.canManage,
        items: items.value,
        pillars: pillars.value,
        cadence: cadence.value,
        settings: settings.value,
        library: media.kind === "ok" ? media.value.library : [],
        videos: media.kind === "ok" ? media.value.videos : [],
        urls: media.kind === "ok" ? media.value.urls : {},
        lastPlan: plan.kind === "ok" ? plan.value : null,
        figures: figures.kind === "ok" ? figures.value : null,
    })
}
