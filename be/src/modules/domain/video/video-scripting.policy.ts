import type { EditorScene } from "./video-workbench.contracts"
import { editorScenesOf, videoRecord } from "./video-workbench.policy"
import type { VideoScriptQuoteState } from "./types/video-scripting.contracts"

/** Maximum age of a script operation before a fresh request may replace it. */
export const VIDEO_SCRIPT_STALE_MS = 5 * 60_000

/** A validated agent answer containing a title and editable scenes. */
export interface ParsedVideoScript {
    /** Proposed working title. */
    readonly title: string
    /** Stable scenes with hook and closing roles normalized. */
    readonly scenes: ReadonlyArray<EditorScene>
}

const closeBefore = (stack: ReadonlyArray<string>, open: string): string =>
    stack
        .slice(stack.lastIndexOf(open) + 1)
        .reverse()
        .map((item) => (item === "{" ? "}" : "]"))
        .join("")

/** Parsed JSON, retaining a rejected parse's diagnostic cause. */
interface ScriptJsonOutcome {
    /** Valid or malformed JSON. */
    readonly kind: "ok" | "refused"
    /** Parsed value, or null. */
    readonly value: unknown
    /** Parse error, or null. */
    readonly cause: unknown
}

/** Coarse progress of an unfinished operation. */
interface VideoScriptProgress {
    /** Queued or running. */
    readonly status: string
    /** Completion percent. */
    readonly progress: number
}

/** The fixed story role for one generated scene. */
export const videoScriptRoleAt = (index: number, count: number): string => {
    if (index === 0) return "hook"
    return index === count - 1 ? "cta" : "body"
}

const openingOf = (closer: string): string => (closer === "}" ? "{" : "[")

const quoteState = (character: string, escaped: boolean): VideoScriptQuoteState => {
    if (escaped) return { quoted: true, escaped: false }
    if (character === "\\") return { quoted: true, escaped: true }
    return { quoted: character !== '"', escaped: false }
}

/** Extracts the first complete JSON object, repairing missing nested closers but refusing truncation. */
export const extractVideoScriptJson = (text: string): string | null => {
    const body = text.replace(/```(?:json)?/giu, "").trim()
    const start = body.indexOf("{")
    if (start < 0) return null
    const stack: Array<string> = []
    let output = ""
    let quoted = false
    let escaped = false
    for (const character of body.slice(start)) {
        if (quoted) {
            output += character
            const state = quoteState(character, escaped)
            escaped = state.escaped
            quoted = state.quoted
        } else if (character === '"') {
            quoted = true
            output += character
        } else if (character === "{" || character === "[") {
            stack.push(character)
            output += character
        } else if (character === "}" || character === "]") {
            const open = openingOf(character)
            if (!stack.includes(open)) continue
            output += closeBefore(stack, open)
            stack.length = stack.lastIndexOf(open)
            output = output.replace(/,\s*$/u, "") + character
            if (stack.length === 0) return output
        } else output += character
    }
    return null
}

const parse = (text: string): ScriptJsonOutcome => {
    try {
        return { kind: "ok", value: JSON.parse(text), cause: null }
    } catch (cause) {
        return { kind: "refused", value: null, cause }
    }
}

/** Parses the answer without trusting generated media paths, and preserves editor roles, identities and footage suggestions. */
export const parseVideoScript = (text: string, generationId: string, workspaceId: string): ParsedVideoScript | null => {
    const json = extractVideoScriptJson(text)
    if (json === null) return null
    const answer = videoRecord(parse(json).value)
    const cleaned = editorScenesOf(answer.scenes, workspaceId)
    if (cleaned.length < 2) return null
    const scenes = cleaned.map((scene, index, all) => ({
        ...scene,
        id: `${generationId}-${index + 1}`,
        role: videoScriptRoleAt(index, all.length),
        media: null,
    }))
    return {
        title: typeof answer.title === "string" ? answer.title.replace(/\s+/gu, " ").trim().slice(0, 120) : "",
        scenes,
    }
}

/** Stable state shown before the domain completion step finishes. */
export const videoScriptProgress = (status: string): VideoScriptProgress =>
    status === "queued" ? { status: "queued", progress: 0 } : { status: "running", progress: 50 }
