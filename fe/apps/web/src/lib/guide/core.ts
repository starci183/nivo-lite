import { matchPage } from "./match"
import { GUIDE_PAGES, pageAt, pagesFor, type GuidePage } from "./sitemap"
import type { GuideText } from "./text"
import type { GuideLink, GuideReply, GuideTurn } from "./types"

/**
 * The NIVO guide brain, free of Next and of the database so it can be checked on its own: a question that clearly names a place is
 * answered from the site map (no tokens); anything else goes to the model with the map the member may see, and the model answer is
 * cut down to links that exist in that map. The guide only shows the way; it never acts.
 */

/** The model call: system and user messages in, the model text out. */
export type GuideGenerate = (
    messages: ReadonlyArray<{ role: "system" | "user"; content: string }>,
) => Promise<{ ok: true; output: string } | { ok: false }>

/** One question to answer. */
export interface GuideInput {
    readonly question: string
    /** The console path the member is on (for "you are here"). */
    readonly path: string
    readonly history: ReadonlyArray<GuideTurn>
    readonly isManager: boolean
}

const MAX_QUESTION = 500
const MAX_ANSWER = 600
const MAX_STEP = 160
const MAX_STEPS = 5
const MAX_LINKS = 3
const HISTORY_TURNS = 6
const HISTORY_CLIP = 300

const linkTo = (page: GuidePage, text: GuideText): GuideLink => ({
    pageId: page.id,
    label: text.open(text.title(page.id)),
    href: page.path,
    ...(page.target ? { target: page.target } : {}),
})

/** One line per page the member may see: what the model is allowed to point at. */
const mapLines = (pages: ReadonlyArray<GuidePage>, text: GuideText): string =>
    pages
        .map(
            (page) =>
                `- ${page.id} | ${text.title(page.id)} | ${text.what(page.id)} | ${text.steps(page.id).join(" > ")}`,
        )
        .join("\n")

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The first JSON object in a model reply (tolerates code fences and prose around it). */
const parseObject = (raw: string): Readonly<Record<string, unknown>> | null => {
    const start = raw.indexOf("{")
    const end = raw.lastIndexOf("}")
    if (start < 0 || end <= start) return null
    try {
        const value: unknown = JSON.parse(raw.slice(start, end + 1))
        return isRecord(value) ? value : null
    } catch {
        return null
    }
}

const clip = (value: string, length: number): string =>
    value.length > length ? `${value.slice(0, length - 1).trimEnd()}...` : value

const stringsOf = (value: unknown): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []

/** The reply that says the guide cannot answer now. */
const busyReply = (text: GuideText): GuideReply => ({ answer: text.busy, steps: [], links: [], source: "busy" })

/** The answer for a question: from the map when it clearly names a place, else from the model. */
export const answerGuide = async (input: GuideInput, text: GuideText, generate: GuideGenerate): Promise<GuideReply> => {
    const question = input.question.trim().slice(0, MAX_QUESTION)
    if (!question) return { answer: text.empty, steps: [], links: [], source: "map" }

    // 1. The site map: a clear hit costs nothing. Staff asking for a settings page are told who does it.
    const hit = matchPage(question, GUIDE_PAGES, text.keywords)
    if (hit && hit.managerOnly && !input.isManager) {
        return { answer: text.managerOnly(text.title(hit.id)), steps: [], links: [], source: "map" }
    }
    if (hit) {
        return {
            answer: `${text.title(hit.id)}: ${text.what(hit.id)}`,
            steps: text.steps(hit.id),
            links: [linkTo(hit, text)],
            source: "map",
        }
    }

    // 2. The model, with only the pages this member may be sent to.
    const allowed = pagesFor(input.isManager)
    const here = pageAt(input.path)
    const history = input.history
        .slice(-HISTORY_TURNS)
        .map((turn) => `${turn.role === "user" ? "User" : "Guide"}: ${clip(turn.text, HISTORY_CLIP)}`)
        .join("\n")
    const user = [
        `PAGES (id | name | what it is for | how):\n${mapLines(allowed, text)}`,
        `CURRENT PAGE: ${here ? `${here.id} (${text.title(here.id)})` : input.path}`,
        history ? `CONVERSATION SO FAR:\n${history}` : "",
        `QUESTION: ${question}`,
    ]
        .filter(Boolean)
        .join("\n\n")
    const system = [...text.systemLines(input.isManager), text.replyFormat].join("\n")
    const reply = await generate([
        { role: "system", content: system },
        { role: "user", content: user },
    ])
    if (!reply.ok) return busyReply(text)
    const object = parseObject(reply.output)
    const answer = typeof object?.answer === "string" ? clip(object.answer.trim(), MAX_ANSWER) : ""
    if (!answer) return busyReply(text)
    const steps = stringsOf(object?.steps)
        .filter((step) => step.trim() !== "")
        .slice(0, MAX_STEPS)
        .map((step) => clip(step.trim(), MAX_STEP))
    const links = [...new Set(stringsOf(object?.pages))]
        .flatMap((id) => allowed.filter((page) => page.id === id))
        .slice(0, MAX_LINKS)
        .map((page) => linkTo(page, text))
    return { answer, steps, links, source: "ai" }
}
