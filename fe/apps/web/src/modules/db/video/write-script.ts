"use server"
import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getTranslations } from "next-intl/server"
import { after } from "next/server"
import { buildAgentContext } from "@/lib/knowledge/index"
import { lensFor, lensSources } from "@/lib/knowledge/lens"
import { generateWithOpenClaw } from "@/lib/openclaw-generate"
import type { GenMessage } from "@/lib/openclaw-generate"
import { goalTemplateOf, isGoal, isRecord, isUuid, parseScriptOutput, readInputs, scenePlan } from "@/modules/video"
import type { Brand, GoalTemplate, ProjectView } from "@/modules/video"
import type { Database } from "../../../../../../../supabase/types/database.types"
import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { readBrand } from "./read-brand"
import { readProjectRow } from "./read-project-row"
import { readProject } from "./read-projects"
import { readManagerScope } from "./read-scope"
import type { ManagerScope } from "./read-scope"
import { writeEvidence } from "./write-evidence"
import { ERROR_CODE_PREFIX, isScriptStale } from "./video.mapper"
import type { ProjectRow } from "./video.mapper"

/** The database client the script run keeps from the request. */
type Client = SupabaseClient<Database>

/** The catalog translator of the video namespace. */
type Translator = Awaited<ReturnType<typeof getTranslations>>

const SOURCE_CHARS_EACH = 1600
const SOURCE_CHARS_TOTAL = 5200
const GENERATE_TIMEOUT_MS = 110_000

/** What a script run needs, all read before the response is sent. */
interface ScriptRun {
    readonly client: Client
    readonly scope: ManagerScope
    readonly row: ProjectRow
    readonly brand: Brand
    readonly t: Translator
}

const sourcesText = async (workspaceId: string, ids: ReadonlyArray<string>): Promise<string> => {
    if (ids.length === 0) return ""
    const rows = (await lensSources(lensFor(workspaceId, "video"), 200)).filter((row) => ids.includes(row.id))
    const parts: Array<string> = []
    let budget = SOURCE_CHARS_TOTAL
    for (const row of rows) {
        const text = row.content
            .replace(/[ \t]+/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .slice(0, Math.min(SOURCE_CHARS_EACH, budget))
        if (text === "") continue
        budget -= text.length
        parts.push(`### ${row.topic === null ? "" : `${row.topic} / `}${row.title}\n${text}`)
        if (budget <= 0) break
    }
    return parts.join("\n\n")
}

const roleAt = (index: number, count: number): string => {
    if (index === 0) return "hook"
    return index === count - 1 ? "cta" : "body"
}

const outlineOf = (seconds: number, goal: GoalTemplate): string => {
    const plan = scenePlan(seconds)
    const bodies = goal.scenes.filter((scene) => scene.role === "body").map((scene) => scene.brief)
    const briefOf = (role: string, bodyIndex: number): string => {
        if (role === "body") return bodies[bodyIndex % Math.max(1, bodies.length)] ?? ""
        return goal.scenes.find((scene) => scene.role === role)?.brief ?? ""
    }
    const lines = Array.from({ length: plan.scenes }, (_, index) => {
        const role = roleAt(index, plan.scenes)
        return `${index + 1}. ${role.toUpperCase()}: ${briefOf(role, index - 1)}`
    })
    return lines.join("\n")
}

const messagesOf = async (run: ScriptRun): Promise<ReadonlyArray<GenMessage>> => {
    const { row, brand, t, scope } = run
    const goal = goalTemplateOf(isGoal(row.goal) ? row.goal : "custom")
    const inputs = readInputs(row.inputs)
    const plan = scenePlan(row.target_seconds)
    const info = await sourcesText(scope.workspaceId, inputs.sourceIds)
    const query = [goal.label.vi, inputs.notes, info.slice(0, 300)].filter((part) => part !== "").join(" ")
    const context = await buildAgentContext({
        workspaceId: scope.workspaceId,
        module: "video",
        query,
        audience: "customer",
        limit: 6,
    })
    const user = [
        t("promptShop", { name: brand.shopName === "" ? t("promptNameUnset") : brand.shopName }),
        t("promptGoal", { label: goal.label.vi, hint: goal.hint.vi }),
        t("promptFormat", { aspect: row.aspect, seconds: row.target_seconds }),
        t("promptScenes", { scenes: plan.scenes, chars: plan.voiceChars, max: plan.voiceChars + 30 }),
        t("promptOutline", { outline: outlineOf(row.target_seconds, goal) }),
        inputs.notes === "" ? "" : t("promptStress", { notes: inputs.notes }),
        info === "" ? t("promptInfoNone") : t("promptInfo", { info }),
        inputs.media.length > 0 ? t("promptMediaSome", { n: inputs.media.length }) : t("promptMediaNone"),
        t("promptReturn"),
    ]
        .filter((line) => line !== "")
        .join("\n\n")
    return [
        { role: "system", content: `${t.raw("promptSystem")}\n\n${context.system}` },
        { role: "user", content: user },
    ]
}

const failRun = async (run: ScriptRun, message: string): Promise<void> => {
    await run.client
        .from("video_projects")
        .update({ status: "draft", last_error: message })
        .eq("workspace_id", run.scope.workspaceId)
        .eq("id", run.row.id)
        .eq("status", "scripting")
}

/** A generation that did not produce text. */
interface RefusedGeneration {
    readonly reason: string
    readonly message: string
}

/** A script run that ends with the text to store on the project. */
class ScriptRefused extends Error {
    constructor(readonly stored: string) {
        super(stored)
    }
}

/** What a refused generation stores on the project: the quota message as is, else a code of the video catalog. */
const storedReason = (failure: RefusedGeneration): string => {
    if (failure.reason === "quota") return failure.message
    if (failure.reason === "engine_offline" || failure.reason === "not_configured") {
        return `${ERROR_CODE_PREFIX}scriptOffline`
    }
    return `${ERROR_CODE_PREFIX}scriptBusy`
}

/** One OpenClaw call (a second only when the first answer was not valid JSON), then the scenes are saved on the project. */
const runScripting = async (run: ScriptRun): Promise<void> => {
    const started = Date.now()
    const messages = await messagesOf(run)
    const retry: GenMessage = { role: "user", content: run.t("promptRetry") }
    const attempt = async (attempts: number) =>
        generateWithOpenClaw({
            workspaceId: run.scope.workspaceId,
            purpose: "video_script",
            module: "video",
            kind: "engine",
            responseFormat: "json",
            timeoutMs: GENERATE_TIMEOUT_MS,
            messages: attempts === 0 ? messages : [...messages, retry],
        })
    const first = await attempt(0)
    if (!first.ok) throw new ScriptRefused(storedReason(first))
    const firstParsed = parseScriptOutput(first.output)
    const second = firstParsed === null ? await attempt(1) : null
    if (second !== null && !second.ok) throw new ScriptRefused(storedReason(second))
    const last = second ?? first
    const parsed = firstParsed ?? (second === null ? null : parseScriptOutput(second.output))
    if (parsed === null) throw new ScriptRefused(`${ERROR_CODE_PREFIX}scriptFormat`)
    const media = readInputs(run.row.inputs).media
    const scenes = parsed.scenes.map((scene, index) => ({
        ...scene,
        media: media.length > 0 ? (media[index % media.length] ?? null) : null,
    }))
    const meta = isRecord(run.row.script_meta) ? run.row.script_meta : {}
    const total = Date.now() - started
    const saved = toOutcome(
        await run.client
            .from("video_projects")
            .update({
                status: "draft",
                script: scenes,
                last_error: null,
                script_ms: total,
                ...(meta.auto_title === true && parsed.title !== "" ? { title: parsed.title } : {}),
                script_meta: {
                    ...meta,
                    generation_id: last.generationId,
                    timings: last.timings,
                    attempts: second === null ? 1 : 2,
                    finished_at: new Date().toISOString(),
                },
            })
            .eq("workspace_id", run.scope.workspaceId)
            .eq("id", run.row.id)
            .eq("status", "scripting")
            .select("title")
            .maybeSingle(),
    )
    if (saved.kind !== "ok") throw new ScriptRefused(`${ERROR_CODE_PREFIX}scriptFailed`)
    await writeEvidence(run.client, run.scope.workspaceId, {
        kind: "video.script_generated",
        actor: "OpenClaw",
        summary: run.t("evidenceScripted", {
            title: saved.value.title,
            scenes: scenes.length,
            seconds: (total / 1000).toFixed(1),
        }),
        evidence: scenes.map((scene, index) => `${index + 1}. ${scene.caption}`).join("\n"),
    })
}

const guarded = async (run: ScriptRun): Promise<void> => {
    try {
        await runScripting(run)
    } catch (cause) {
        await failRun(run, cause instanceof ScriptRefused ? cause.stored : `${ERROR_CODE_PREFIX}scriptFailed`)
    }
}

/**
 * Starts writing the script: marks the project as being scripted and finishes the long OpenClaw call after the response;
 * the screen polls the project until the status leaves "scripting". A second click while one is running starts nothing.
 */
export const startVideoScript = async (id: unknown): Promise<DbOutcome<ProjectView>> => {
    const scope = await readManagerScope()
    if (scope.kind !== "ok") return scope
    if (!isUuid(id)) return dbFailure("invalid", "project-id")
    const client = await createServerDbClient()
    const found = await readProjectRow(client, scope.value.workspaceId, id)
    if (found.kind !== "ok") return found
    const row = found.value
    if (row.status === "rendering") return dbFailure("invalid", "video-busy")
    if (row.status === "scripting" && !isScriptStale(row, Date.now())) return readProject(scope.value.workspaceId, id)
    const brand = await readBrand(scope.value.workspaceId)
    if (brand.kind !== "ok") return brand
    const meta = isRecord(row.script_meta) ? row.script_meta : {}
    const marked = toOutcome(
        await client
            .from("video_projects")
            .update({
                status: "scripting",
                last_error: null,
                script_meta: { ...meta, started_at: new Date().toISOString() },
            })
            .eq("workspace_id", scope.value.workspaceId)
            .eq("id", id)
            .select("*")
            .maybeSingle(),
    )
    if (marked.kind !== "ok") return marked
    const t = await getTranslations("video")
    const run: ScriptRun = { client, scope: scope.value, row: marked.value, brand: brand.value, t }
    after(() => guarded(run))
    return readProject(scope.value.workspaceId, id)
}
