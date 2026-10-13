import "server-only"

import { createServerDbClient } from "../server"
import { toOutcome } from "../outcome"
import { dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { lensFacts, lensFor, lensSources } from "@/lib/knowledge/lens"

/** What the business told the setup of the content module (tone and limits gates, summary, confirmed facts). */
export interface SetupContext {
    readonly summary: string
    readonly facts: ReadonlyArray<string>
    readonly tone: string
    readonly claimsLimits: string
    readonly audience: string
    readonly channels: string
}

/** The raw material the posts are grounded in; the prompt text is assembled from it. */
export interface BrandMaterial {
    readonly shop: string
    readonly authority: { readonly brandVoice: string; readonly replyStyle: string; readonly limitsNote: string }
    readonly setup: SetupContext
    readonly sources: ReadonlyArray<{ readonly title: string; readonly topic: string | null; readonly content: string }>
    readonly brainFacts: ReadonlyArray<{ readonly subject: string; readonly attribute: string; readonly value: string }>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const evidenceOf = (gates: unknown, key: string): string => {
    if (!isObject(gates)) return ""
    const gate = Object.entries(gates).find(([name]) => name === key)?.[1]
    return isObject(gate) && typeof gate.evidence === "string" ? gate.evidence.trim() : ""
}

const readSetup = async (workspaceId: string): Promise<SetupContext> => {
    const empty: SetupContext = { summary: "", facts: [], tone: "", claimsLimits: "", audience: "", channels: "" }
    const client = await createServerDbClient()
    const installed = toOutcome(
        await client
            .from("module_installations")
            .select("active_context_version_id")
            .eq("workspace_id", workspaceId)
            .eq("module_key", "content")
            .maybeSingle(),
    )
    if (installed.kind !== "ok" || installed.value.active_context_version_id === null) return empty
    const version = toOutcome(
        await client
            .from("module_context_versions")
            .select("snapshot")
            .eq("id", installed.value.active_context_version_id)
            .maybeSingle(),
    )
    const snapshot = version.kind === "ok" ? version.value.snapshot : null
    if (!isObject(snapshot)) return empty
    return {
        summary: typeof snapshot.summary === "string" ? snapshot.summary : "",
        facts: Array.isArray(snapshot.facts)
            ? snapshot.facts.flatMap((fact: unknown) =>
                  isObject(fact) && typeof fact.text === "string" ? [fact.text] : [],
              )
            : [],
        tone: evidenceOf(snapshot.gates, "tone"),
        claimsLimits: evidenceOf(snapshot.gates, "claims_limits"),
        audience: evidenceOf(snapshot.gates, "audience"),
        channels: evidenceOf(snapshot.gates, "channels"),
    }
}

/**
 * Reads everything the posts are grounded in. Posts are published, so the knowledge lens is public-only (documents and approved brain facts),
 * whatever a source or fact says about other modules.
 */
export const readBrandMaterial = async (workspaceId: string): Promise<DbOutcome<BrandMaterial>> => {
    const client = await createServerDbClient()
    const lens = lensFor(workspaceId, "content")
    const [shop, authority, setup, sources, brain] = await Promise.all([
        client.from("workspaces").select("name").eq("id", workspaceId).maybeSingle(),
        client
            .from("authority")
            .select("brand_voice, reply_style, limits_note")
            .eq("workspace_id", workspaceId)
            .maybeSingle(),
        readSetup(workspaceId),
        lensSources(lens, 200),
        lensFacts(lens, undefined, 40).catch(() => []),
    ])
    return dbOk({
        shop: (shop.data?.name ?? "").trim(),
        authority: {
            brandVoice: authority.data?.brand_voice ?? "",
            replyStyle: authority.data?.reply_style ?? "",
            limitsNote: authority.data?.limits_note ?? "",
        },
        setup,
        sources: sources.map((s) => ({ title: s.title, topic: s.topic, content: s.content })),
        brainFacts: brain.map((f) => ({ subject: f.subjectLabel, attribute: f.attributeLabel, value: f.value })),
    })
}
