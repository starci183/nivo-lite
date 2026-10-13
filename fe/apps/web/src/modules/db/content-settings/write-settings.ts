"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { readContentManager } from "../content/read-actor"
import { readContentPillars, readContentSettings } from "../content/read-items"
import {
    parseAutomationKey,
    parseBrand,
    parseCadence,
    parsePillars,
    type CadenceInput,
    type PillarInput,
} from "./content-settings.mapper"
import { CADENCE_PRESETS, PILLAR_PRESETS, cleanHashtags } from "@/modules/content"

const refresh = (): void => revalidatePath("/", "layout")

const done = (result: {
    readonly error: { readonly message: string; readonly code?: string } | null
}): DbOutcome<null> => {
    const checked = toOutcome({ data: true, error: result.error })
    return checked.kind === "ok" ? dbOk(null) : checked
}

const saveRows = async (workspaceId: string, rows: ReadonlyArray<PillarInput>): Promise<DbOutcome<null>> => {
    const client = await createServerDbClient()
    const keep = rows.flatMap((row) => (row.id === undefined ? [] : [row.id]))
    const current = toOutcome(await client.from("content_pillars").select("id").eq("workspace_id", workspaceId))
    if (current.kind !== "ok") return current
    const drop = current.value.map((row) => row.id).filter((id) => !keep.includes(id))
    if (drop.length > 0) {
        const removed = done(
            await client.from("content_pillars").delete().in("id", drop).eq("workspace_id", workspaceId),
        )
        if (removed.kind !== "ok") return removed
    }
    const results = await Promise.all(
        rows.map((row, sort) => {
            const body = {
                workspace_id: workspaceId,
                name: row.name,
                description: row.description,
                weight: row.weight,
                active: row.active,
                sort,
            }
            return row.id === undefined
                ? client.from("content_pillars").insert(body)
                : client.from("content_pillars").update(body).eq("id", row.id).eq("workspace_id", workspaceId)
        }),
    )
    return results.map(done).find((outcome) => outcome.kind !== "ok") ?? dbOk(null)
}

/** Saves the content themes of the workspace (rows not in the list are removed). Owner or manager only. */
export const writeSavePillars = async (input: unknown): Promise<DbOutcome<{ readonly n: number }>> => {
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    const rows = parsePillars(input)
    if (rows === null) return dbFailure("invalid", "input")
    const names = rows.map((row) => row.name.toLowerCase())
    if (new Set(names).size !== names.length) return dbFailure("invalid", "pillar_duplicate")
    const saved = await saveRows(actor.value.workspaceId, rows)
    if (saved.kind !== "ok") return saved
    refresh()
    return dbOk({ n: rows.length })
}

/** Adds the suggested themes when the workspace has none. Owner or manager only. */
export const writeApplyPillarPresets = async (): Promise<DbOutcome<{ readonly n: number }>> => {
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    const current = await readContentPillars(actor.value.workspaceId)
    if (current.kind !== "ok") return current
    if (current.value.length > 0) return dbOk({ n: current.value.length })
    const client = await createServerDbClient()
    const inserted = done(
        await client.from("content_pillars").insert(
            PILLAR_PRESETS.map((preset, sort) => ({
                workspace_id: actor.value.workspaceId,
                name: preset.name,
                description: preset.description,
                weight: preset.weight,
                sort,
            })),
        ),
    )
    if (inserted.kind !== "ok") return inserted
    refresh()
    return dbOk({ n: PILLAR_PRESETS.length })
}

const saveCadenceRows = async (workspaceId: string, rows: ReadonlyArray<CadenceInput>): Promise<DbOutcome<null>> => {
    const client = await createServerDbClient()
    const body = rows.map((row) => ({
        workspace_id: workspaceId,
        channel: row.channel,
        posts_per_week: row.postsPerWeek,
        days: [...row.days],
        post_time: row.time,
    }))
    const upserted = done(await client.from("content_cadence").upsert(body, { onConflict: "workspace_id,channel" }))
    if (upserted.kind !== "ok") return upserted
    const keep = rows.map((row) => row.channel)
    const base = client.from("content_cadence").delete().eq("workspace_id", workspaceId)
    return done(await (keep.length > 0 ? base.not("channel", "in", `(${keep.join(",")})`) : base))
}

/** Saves the posting rhythm (channels not in the list are removed). Owner or manager only. */
export const writeSaveCadence = async (input: unknown): Promise<DbOutcome<{ readonly n: number }>> => {
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    const rows = parseCadence(input)
    if (rows === null) return dbFailure("invalid", "time_invalid")
    const saved = await saveCadenceRows(actor.value.workspaceId, rows)
    if (saved.kind !== "ok") return saved
    refresh()
    return dbOk({ n: rows.length })
}

/** Replaces the posting rhythm with the suggested one. Owner or manager only. */
export const writeApplyCadencePresets = async (): Promise<DbOutcome<{ readonly n: number }>> =>
    writeSaveCadence(
        CADENCE_PRESETS.map((c) => ({
            channel: c.channel,
            postsPerWeek: c.posts_per_week,
            days: c.days,
            time: c.time,
        })),
    )

/** Saves the brand voice, the words to avoid, the call to action and the brand hashtags. Owner or manager only. */
export const writeSaveBrand = async (input: unknown): Promise<DbOutcome<null>> => {
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    const brand = parseBrand(input)
    if (brand === null) return dbFailure("invalid", "input")
    const client = await createServerDbClient()
    const saved = done(
        await client.from("content_settings").upsert(
            {
                workspace_id: actor.value.workspaceId,
                brand_voice: brand.brandVoice,
                avoid: brand.avoid,
                cta: brand.cta,
                hashtags: cleanHashtags(
                    brand.hashtags
                        .split(/[\s,]+/)
                        .filter(Boolean)
                        .slice(0, 15),
                ),
            },
            { onConflict: "workspace_id" },
        ),
    )
    if (saved.kind !== "ok") return saved
    refresh()
    return dbOk(null)
}

/** Switches one automation on or off. The automations themselves run in the back end. Owner or manager only. */
export const writeSetAutomation = async (key: string, on: boolean): Promise<DbOutcome<null>> => {
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    const automation = parseAutomationKey(key)
    if (automation === null || typeof on !== "boolean") return dbFailure("invalid", "input")
    const current = await readContentSettings(actor.value.workspaceId)
    if (current.kind !== "ok") return current
    const client = await createServerDbClient()
    const saved = done(
        await client.from("content_settings").upsert(
            {
                workspace_id: actor.value.workspaceId,
                automations: { ...current.value.automations, [automation]: on },
            },
            { onConflict: "workspace_id" },
        ),
    )
    if (saved.kind !== "ok") return saved
    refresh()
    return dbOk(null)
}
