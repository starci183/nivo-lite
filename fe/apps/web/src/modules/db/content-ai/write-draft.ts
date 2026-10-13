"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { evidenceToJson, mediaToJson, variantsToJson } from "../content/content.mapper"
import { readContentManager, type ContentActor } from "../content/read-actor"
import { readContentItem, readContentPillars, readContentSettings } from "../content/read-items"
import { readMediaLibrary } from "../content/read-media"
import { appendItemEvidence, appendPolicyDecision, appendWorkspaceEvent } from "../content/write-events"
import { buildBrand, draftSystem, draftUser, type PromptTranslator } from "./content-ai.mapper"
import { readBrandMaterial } from "./read-brand"
import { readDraftingBlocked, readRecentTitles } from "./read-draft"
import { generateJson } from "./write-generate"
import {
    CONTENT_CHANNELS,
    channelRule,
    claimWarnings,
    cleanHashtags,
    eventsForMonth,
    isContentChannel,
    isJsonObject,
    trimmedText,
    vietnamClock,
    warningMessage,
    type ChannelWarning,
    type ContentChannel,
    type MediaRef,
    type Variants,
} from "@/modules/content"

/** What a finished draft produced. */
export interface DraftSummary {
    readonly warnings: ReadonlyArray<ChannelWarning>
    readonly seconds: number
    readonly itemId: string
}

const SUGGESTED_MEDIA = 2
const LIBRARY_LIMIT = 40
const LENGTH_SLACK = 1.25

interface DraftOptions {
    readonly channels?: ReadonlyArray<ContentChannel>
    readonly hint?: string
}

/** The hashtags of one channel, within its limits (TikTok and Instagram also get the brand ones). */
const channelHashtags = (channel: ContentChannel, written: unknown, brand: ReadonlyArray<string>): Array<string> => {
    const rule = channelRule(channel)
    const own = cleanHashtags(Array.isArray(written) ? written.map(String) : [])
    if (rule.hashtags.max === 0) return []
    const merged = channel === "tiktok" || channel === "instagram" ? cleanHashtags([...own, ...brand]) : own
    return merged.slice(0, rule.hashtags.max)
}

const draftBody = async (
    actor: ContentActor,
    itemId: string,
    options: DraftOptions,
    t: PromptTranslator,
    started: number,
): Promise<DbOutcome<DraftSummary>> => {
    const ws = actor.workspaceId
    const found = await readContentItem(ws, itemId)
    if (found.kind !== "ok") return found
    const item = found.value
    if (item.status !== "idea" && item.status !== "draft") return dbFailure("invalid", "wrong_status")
    if (await readDraftingBlocked(ws)) return dbFailure("refused", "drafting_off")
    const channels = (options.channels?.length ? options.channels : item.channels).filter(isContentChannel)
    const [pillars, settings, recent, material, library] = await Promise.all([
        readContentPillars(ws),
        readContentSettings(ws),
        readRecentTitles(ws, itemId),
        readBrandMaterial(ws),
        readMediaLibrary(ws, LIBRARY_LIMIT),
    ])
    if (pillars.kind !== "ok") return pillars
    if (settings.kind !== "ok") return settings
    if (material.kind !== "ok") return material
    const brand = buildBrand(t, material.value, settings.value)
    const files = library.kind === "ok" ? library.value : []
    const pillar = pillars.value.find((p) => p.id === item.pillar_id) ?? null
    const when = vietnamClock(item.scheduled_at ? new Date(item.scheduled_at) : new Date())
    const holiday = item.holiday_key
        ? (eventsForMonth(when.y, when.m).find((h) => h.key === item.holiday_key) ?? null)
        : null
    const answer = await generateJson({
        workspaceId: ws,
        purpose: "content_draft",
        module: "content",
        responseFormat: "json",
        timeoutMs: 90_000,
        messages: [
            { role: "system", content: draftSystem(t, brand, channels) },
            {
                role: "user",
                content: draftUser(t, {
                    title: item.title,
                    brief: item.brief,
                    pillar,
                    pillarNames: pillars.value.filter((p) => p.active).map((p) => p.name),
                    scheduledAt: item.scheduled_at,
                    holiday,
                    hint: options.hint ?? "",
                    recent: recent.kind === "ok" ? recent.value : [],
                    library: files.map((m) => m.name),
                }),
            },
        ],
    })
    if (answer.kind !== "ok") return answer
    const parsed = answer.value.parsed
    if (!isJsonObject(parsed.variants)) return dbFailure("unavailable", "ai_unreadable")
    const written = parsed.variants
    const variants: Variants = { ...item.variants }
    const warnings: Array<ChannelWarning> = []
    for (const channel of channels) {
        const raw = written[channel]
        const text = isJsonObject(raw) ? trimmedText(raw.text) : ""
        if (text === "") continue
        variants[channel] = {
            text,
            hashtags: channelHashtags(channel, isJsonObject(raw) ? raw.hashtags : [], brand.brandHashtags),
            note: isJsonObject(raw) ? trimmedText(raw.note) : "",
        }
        const max = channelRule(channel).max_chars
        if (text.length > max * LENGTH_SLACK)
            warnings.push({ channel, warning: { kind: "length", length: text.length, max } })
        warnings.push(...claimWarnings(text, brand.knowledge).map((warning) => ({ channel, warning })))
    }
    if (!channels.some((c) => variants[c]?.text)) return dbFailure("invalid", "ai_empty")

    const picked = (Array.isArray(parsed.media) ? parsed.media : [])
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= files.length)
        .slice(0, SUGGESTED_MEDIA)
    const media: Array<MediaRef> = [
        ...item.media.filter((m) => !m.suggested),
        ...picked.map((n) => ({ ...files[n - 1], suggested: true })),
    ]
    const pillarName = trimmedText(parsed.pillar).toLowerCase()
    const chosen = item.pillar_id ? null : (pillars.value.find((p) => p.name.toLowerCase() === pillarName) ?? null)
    const title = item.source === "quick" ? trimmedText(parsed.title).slice(0, 200) : ""
    const ms = Date.now() - started
    const client = await createServerDbClient()
    const saved = toOutcome(
        await client
            .from("content_items")
            .update({
                variants: variantsToJson(variants),
                hashtags: cleanHashtags(Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : item.hashtags),
                media: mediaToJson(media),
                status: "draft",
                drafted_at: new Date().toISOString(),
                channels: [...new Set([...item.channels, ...channels])],
                ...(chosen ? { pillar_id: chosen.id } : {}),
                ...(title ? { title } : {}),
            })
            .eq("id", itemId)
            .eq("workspace_id", ws)
            .in("status", ["idea", "draft"])
            .select("id")
            .single(),
    )
    if (saved.kind !== "ok") return saved
    const seconds = Math.round(ms / 1000)
    const warned = warnings.map(
        (w) => `${channelRule(w.channel).label}: ${t(warningMessage(w.warning).key, warningMessage(w.warning).values)}`,
    )
    await appendItemEvidence(ws, itemId, {
        kind: "drafted",
        by: "NIVO",
        text: [
            t("evDrafted", { channels: channels.map((c) => channelRule(c).label).join(", "), seconds }),
            warned.length > 0 ? t("evDraftedWarnings", { warnings: warned.join(" ") }) : "",
            actor.name ? t("evDraftedBy", { who: actor.name }) : "",
        ]
            .filter((part) => part !== "")
            .join(" "),
    })
    await appendPolicyDecision(ws, {
        action: "draft_post",
        department: "content",
        decidedBy: "NIVO",
        note: t("decisionDraftNote", { title: item.title }),
    })
    await appendWorkspaceEvent(ws, {
        kind: "content.drafted",
        actor: "NIVO",
        summary: t("evtDrafted", { title: item.title }),
        evidence: channels.join(", "),
    })
    revalidatePath("/", "layout")
    return dbOk({ warnings, seconds, itemId })
}

/** Writes (or rewrites) the channel texts of one idea or draft with OpenClaw. Owner or manager only. */
export const writeDraftItem = async (id: string, hint?: string): Promise<DbOutcome<DraftSummary>> => {
    const started = Date.now()
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    const t = await getTranslations("content")
    return draftBody(actor.value, id, { hint: hint?.trim() }, t, started)
}

/** "Quick idea": a pasted topic becomes a new post, drafted for the chosen channels. Owner or manager only. */
export const writeQuickDraft = async (
    topic: string,
    channels: ReadonlyArray<string>,
): Promise<DbOutcome<DraftSummary>> => {
    const started = Date.now()
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    const clean = typeof topic === "string" ? topic.trim() : ""
    if (clean.length < 3) return dbFailure("invalid", "topic_short")
    const wanted = CONTENT_CHANNELS.filter((c) => Array.isArray(channels) && channels.includes(c))
    if (wanted.length === 0) return dbFailure("invalid", "channels_required")
    const t = await getTranslations("content")
    const client = await createServerDbClient()
    const created = toOutcome(
        await client
            .from("content_items")
            .insert({
                workspace_id: actor.value.workspaceId,
                title: clean.split("\n")[0].slice(0, 80),
                brief: clean,
                channels: [...wanted],
                status: "idea",
                source: "quick",
                created_by: actor.value.name,
                evidence: evidenceToJson([
                    { at: new Date().toISOString(), kind: "created", by: actor.value.name, text: t("evCreatedQuick") },
                ]),
            })
            .select("id")
            .single(),
    )
    if (created.kind !== "ok") return created
    const drafted = await draftBody(actor.value, created.value.id, {}, t, started)
    if (drafted.kind !== "ok") {
        await client
            .from("content_items")
            .delete()
            .eq("id", created.value.id)
            .eq("workspace_id", actor.value.workspaceId)
    }
    return drafted
}
