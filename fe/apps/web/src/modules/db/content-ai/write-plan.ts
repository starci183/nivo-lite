"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { readContentManager } from "../content/read-actor"
import { readContentCadence, readContentItems, readContentPillars, readContentSettings } from "../content/read-items"
import { appendWorkspaceEvent } from "../content/write-events"
import {
    buildBrand,
    offerLines,
    planIdeas,
    planSystem,
    planUser,
    slotLine,
    type BrandContext,
} from "./content-ai.mapper"
import { readBrandMaterial } from "./read-brand"
import { generateJson } from "./write-generate"
import {
    eventsForMonth,
    groupSlots,
    isOfferLine,
    monthKey,
    monthRange,
    pad2,
    parseMonth,
    pillarQuota,
    pinHolidays,
    slotsForMonth,
    themeSequence,
    type PlanSlot,
} from "@/modules/content"

const CHUNK = 12
const EXISTING_LIMIT = 20

/** What a finished plan produced. */
export interface PlanSummary {
    readonly ideas: number
    readonly seconds: number
    readonly skippedPast: number
}

const chunked = <T>(list: ReadonlyArray<T>, size: number): Array<Array<T>> =>
    Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size))

/**
 * "Plan the month": the balance and the holidays are settled in code, so they hold whatever the model does. Each slot gets a theme (by
 * weight, never the same theme twice in a row when avoidable) and each holiday of the month is pinned to the slot just before it. OpenClaw
 * writes the idea of each slot; the ideas are inserted as status idea, replacing the untouched ideas of the previous plan of the month.
 */
export const writePlanMonth = async (ym: string): Promise<DbOutcome<PlanSummary>> => {
    const started = Date.now()
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    const month = parseMonth(ym)
    if (month === null) return dbFailure("invalid", "month_invalid")
    const ws = actor.value.workspaceId
    const [pillars, cadence, settings, material, existing] = await Promise.all([
        readContentPillars(ws),
        readContentCadence(ws),
        readContentSettings(ws),
        readBrandMaterial(ws),
        readContentItems(ws, monthRange(month.y, month.m)),
    ])
    if (pillars.kind !== "ok") return pillars
    if (cadence.kind !== "ok") return cadence
    if (settings.kind !== "ok") return settings
    if (material.kind !== "ok") return material
    if (existing.kind !== "ok") return existing
    const active = pillars.value.filter((p) => p.active && p.weight > 0)
    if (active.length === 0) return dbFailure("invalid", "plan_no_pillars")
    if (!cadence.value.some((c) => c.posts_per_week > 0)) return dbFailure("invalid", "plan_no_cadence")
    const all = slotsForMonth(month.y, month.m, cadence.value)
    const upcoming = slotsForMonth(month.y, month.m, cadence.value, new Date())
    const slots = groupSlots(upcoming)
    if (slots.length === 0) return dbFailure("invalid", "plan_no_slots")

    const t = await getTranslations("content")
    const brand: BrandContext = buildBrand(t, material.value, settings.value)
    const holidays = eventsForMonth(month.y, month.m)
    const quota = pillarQuota(active, slots.length)
    const themes = themeSequence(quota, slots.length)
    const pinned = pinHolidays(slots, holidays)
    const kept = existing.value.filter((i) => !(i.status === "idea" && i.source === "plan"))
    const system = planSystem(t, brand)
    const label = `${pad2(month.m)}/${month.y}`
    const lineOf = (slot: PlanSlot): string =>
        slotLine(
            t,
            slot,
            themes[slot.n - 1],
            holidays.find((h) => h.key === pinned.get(slot.n)),
        )
    const calls = await Promise.all(
        chunked(slots, CHUNK).map((chunk) =>
            generateJson({
                workspaceId: ws,
                purpose: "content_plan",
                module: "content",
                responseFormat: "json",
                timeoutMs: 120_000,
                messages: [
                    { role: "system", content: system },
                    {
                        role: "user",
                        content: planUser(t, {
                            month: label,
                            lines: chunk.map(lineOf),
                            offers: offerLines(t, brand, isOfferLine),
                            existing: kept.slice(0, EXISTING_LIMIT).map((i) => i.title),
                        }),
                    },
                ],
            }),
        ),
    )
    const failed = calls.flatMap((call) => (call.kind === "ok" ? [] : [call]))[0]
    if (failed !== undefined) return failed
    const answers = calls.flatMap((call) => (call.kind === "ok" ? [call.value] : []))
    const seen = new Set<number>()
    const rows = answers
        .flatMap((answer) => planIdeas(answer.parsed))
        .flatMap((idea) => {
            const slot = slots.find((s) => s.n === idea.slot)
            if (slot === undefined || seen.has(idea.slot)) return []
            seen.add(idea.slot)
            return [{ idea, slot }]
        })
    if (rows.length === 0) return dbFailure("invalid", "ai_empty")

    const ms = Date.now() - started
    const client = await createServerDbClient()
    const plan = toOutcome(
        await client
            .from("content_plans")
            .insert({
                workspace_id: ws,
                month: `${month.y}-${pad2(month.m)}-01`,
                status: "done",
                idea_count: rows.length,
                ai_ms: ms,
                meta: {
                    generation_id: answers.map((a) => a.generationId).join(","),
                    model: answers[0]?.model ?? null,
                    slots: slots.length,
                    quota: quota.map((q) => ({ pillar: q.pillar.name, count: q.count })),
                    holidays: holidays.map((h) => h.key),
                    sources: [...brand.sources],
                },
                created_by: actor.value.name,
            })
            .select("id")
            .single(),
    )
    if (plan.kind !== "ok") return plan
    const stale = existing.value.filter((i) => i.status === "idea" && i.source === "plan").map((i) => i.id)
    if (stale.length > 0) await client.from("content_items").delete().in("id", stale).eq("workspace_id", ws)
    const at = new Date().toISOString()
    const inserted = await client.from("content_items").insert(
        rows.map(({ idea, slot }) => ({
            workspace_id: ws,
            plan_id: plan.value.id,
            title: idea.title,
            brief: idea.brief,
            pillar_id: themes[slot.n - 1].id,
            channels: [...slot.channels],
            scheduled_at: slot.at,
            status: "idea",
            source: "plan",
            holiday_key: pinned.get(slot.n) ?? null,
            created_by: actor.value.name,
            evidence: [{ at, kind: "planned", by: "NIVO", text: t("evPlanned", { month: label }) }],
        })),
    )
    const stored = toOutcome({ data: true, error: inserted.error })
    if (stored.kind !== "ok") return stored
    await appendWorkspaceEvent(ws, {
        kind: "content.planned",
        actor: actor.value.name,
        summary: t("evtPlanned", { month: label, n: rows.length }),
        evidence: t("evtPlannedEvidence", { seconds: Math.round(ms / 1000), month: monthKey(month.y, month.m) }),
    })
    revalidatePath("/", "layout")
    return dbOk({ ideas: rows.length, seconds: Math.round(ms / 1000), skippedPast: all.length - upcoming.length })
}
