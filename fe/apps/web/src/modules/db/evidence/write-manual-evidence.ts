"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { simulateInbound } from "@/lib/flow-actions"
import { getSession } from "@/lib/session"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { manualEvidenceSchema } from "./evidence.mapper"

/** What a successful manual entry reports back to the form. */
export interface ManualEvidenceResult {
    /** The same evidence was already admitted: nothing new was recorded. */
    readonly duplicate: boolean
    readonly transactionId: string | null
}

/**
 * Admits one manual piece of evidence (money the owner knows arrived). It goes through the same inbound path as every
 * other input (idempotent ingest, then NIVO matches it to an invoice or asks), so it appears as a bank-credit row with its
 * match state. Like every manual input in this build it is labelled simulated. The date the owner gives becomes the payment date.
 */
export const writeManualEvidence = async (input: unknown): Promise<DbOutcome<ManualEvidenceResult>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = manualEvidenceSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", `evidence-${parsed.field}`)
    const { amount, date, content, note, payer } = parsed.data
    const session = await getSession()
    const body = [content, note].filter(Boolean).join(" - ")
    const ingested = await simulateInbound({
        channel: "manual",
        kind: "payment",
        sender_name: payer,
        amount_vnd: amount,
        external_ref: content,
        body,
    })
    if (!ingested.ok) return dbFailure("unavailable", `evidence-ingest:${ingested.error.slice(0, 80)}`)
    const { event, duplicate } = ingested.data
    if (duplicate) return dbOk({ duplicate, transactionId: null })
    const client = await createServerDbClient()
    const dated = toOutcome(
        await client
            .from("transactions")
            .update({ occurred_at: new Date(`${date}T12:00:00+07:00`).toISOString() })
            .eq("workspace_id", session.workspace.id)
            .eq("inbound_event_id", event.id)
            .select("id")
            .limit(1),
    )
    const t = await getTranslations("workbenchAccounting")
    const logged = toOutcome(
        await client
            .from("events")
            .insert({
                workspace_id: session.workspace.id,
                kind: "accounting.manual_evidence",
                actor: session.userName,
                summary: t("evidenceLog", { amount, date }),
                evidence: body,
            })
            .select("id"),
    )
    revalidatePath("/", "layout")
    if (logged.kind !== "ok") return logged
    return dbOk({ duplicate, transactionId: dated.kind === "ok" ? (dated.value[0]?.id ?? null) : null })
}
