import "server-only"

import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { toCadence, toItem, toPillar, toSettings } from "./content.mapper"
import type { Cadence, ContentItem, ContentSettings, Pillar } from "@/modules/content"

/** The most posts one read returns. */
const ITEM_LIMIT = 500

/** The posts of a workspace, soonest first; optionally only those scheduled in [from, to). */
export const readContentItems = async (
    workspaceId: string,
    range?: { readonly from: string; readonly to: string },
): Promise<DbOutcome<ReadonlyArray<ContentItem>>> => {
    const client = await createServerDbClient()
    const base = client.from("content_items").select("*").eq("workspace_id", workspaceId)
    const scoped = range === undefined ? base : base.gte("scheduled_at", range.from).lt("scheduled_at", range.to)
    const rows = toOutcome(await scoped.order("scheduled_at", { ascending: true, nullsFirst: false }).limit(ITEM_LIMIT))
    return rows.kind === "ok" ? dbOk(rows.value.map(toItem)) : rows
}

/** One post of a workspace. */
export const readContentItem = async (workspaceId: string, id: string): Promise<DbOutcome<ContentItem>> => {
    const client = await createServerDbClient()
    const row = toOutcome(
        await client.from("content_items").select("*").eq("id", id).eq("workspace_id", workspaceId).maybeSingle(),
    )
    if (row.kind === "ok") return dbOk(toItem(row.value))
    return row.kind === "not-found" ? dbFailure("not-found", "item_not_found") : row
}

/** The content themes of a workspace. */
export const readContentPillars = async (workspaceId: string): Promise<DbOutcome<ReadonlyArray<Pillar>>> => {
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("content_pillars")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("sort")
            .order("created_at"),
    )
    return rows.kind === "ok" ? dbOk(rows.value.map(toPillar)) : rows
}

/** The posting rhythm of a workspace. */
export const readContentCadence = async (workspaceId: string): Promise<DbOutcome<ReadonlyArray<Cadence>>> => {
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client.from("content_cadence").select("*").eq("workspace_id", workspaceId).order("channel"),
    )
    return rows.kind === "ok" ? dbOk(rows.value.flatMap(toCadence)) : rows
}

/** The brand and automation settings of a workspace (defaults when nothing was saved yet). */
export const readContentSettings = async (workspaceId: string): Promise<DbOutcome<ContentSettings>> => {
    const client = await createServerDbClient()
    const row = toOutcome(
        await client.from("content_settings").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    )
    if (row.kind === "ok") return dbOk(toSettings(workspaceId, row.value))
    return row.kind === "not-found" ? dbOk(toSettings(workspaceId, null)) : row
}
