"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const SLUG = /^[a-z0-9][a-z0-9-]{2,40}$/u
const ZONE = /^[A-Za-z_]+(?:\/[A-Za-z_+-]+){0,2}$/u

/** The booking rules the owner edits. */
interface PolicyInput {
    readonly workspaceId: string
    readonly cancelWindowHours: number
    readonly depositPct: number
    readonly lateCancelFeePct: number
    readonly noShowFeeVnd: number
    readonly minLeadMin: number
    readonly maxAdvanceDays: number
    readonly slotStepMin: number
    readonly autoConfirm: boolean
    readonly handoffOrder: boolean
    readonly address: string
    readonly timezone: string
}

/** The public page the owner edits. */
interface PublicPageInput {
    readonly workspaceId: string
    readonly enabled: boolean
    readonly slug: string
    readonly note: string
}

const whole = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, Number.isFinite(value) ? Math.round(value) : min))

const slugOf = (raw: string): string =>
    raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/gu, "-")
        .replace(/^-+|-+$/gu, "")

/** Saves the cancellation, deposit and slot rules of the workspace through the manager policy. */
export const writeBookingPolicy = async (input: PolicyInput): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    if (!UUID.test(input.workspaceId) || !ZONE.test(input.timezone)) return dbFailure("invalid", "booking-policy")
    const db = await createServerDbClient()
    const saved = toOutcome(
        await db
            .from("booking_settings")
            .upsert(
                {
                    workspace_id: input.workspaceId,
                    cancel_window_hours: whole(input.cancelWindowHours, 0, 720),
                    deposit_pct: whole(input.depositPct, 0, 100),
                    late_cancel_fee_pct: whole(input.lateCancelFeePct, 0, 100),
                    no_show_fee_vnd: whole(input.noShowFeeVnd, 0, 1_000_000_000),
                    min_lead_min: whole(input.minLeadMin, 0, 100_000),
                    max_advance_days: whole(input.maxAdvanceDays, 1, 365),
                    slot_step_min: whole(input.slotStepMin, 5, 240),
                    auto_confirm: input.autoConfirm,
                    handoff_order: input.handoffOrder,
                    address: input.address.trim().slice(0, 300),
                    timezone: input.timezone,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "workspace_id" },
            )
            .select("workspace_id"),
    )
    if (saved.kind !== "ok") return saved
    revalidatePath("/", "layout")
    return dbOk(true)
}

/** Switches the public booking page on or off and saves its address and note. */
export const writeBookingPublicPage = async (input: PublicPageInput): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const slug = slugOf(input.slug)
    if (!UUID.test(input.workspaceId) || (input.enabled && !SLUG.test(slug)))
        return dbFailure("invalid", "booking-slug")
    const db = await createServerDbClient()
    const saved = toOutcome(
        await db
            .from("booking_settings")
            .upsert(
                {
                    workspace_id: input.workspaceId,
                    public_enabled: input.enabled,
                    public_slug: slug === "" ? null : slug,
                    public_note: input.note.trim().slice(0, 400),
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "workspace_id" },
            )
            .select("workspace_id"),
    )
    if (saved.kind !== "ok") return saved
    revalidatePath("/", "layout")
    return dbOk(true)
}
