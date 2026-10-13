import { matchPage } from "./match"
import { GUIDE_PAGES, pagesFor, type GuidePage } from "./sitemap"
import type { GuideLink, GuideReply, GuideText } from "./types"

/**
 * The NIVO guide brain, free of React and of the network: a question that clearly names a place is answered from the site map (no
 * tokens); anything else goes to the be `askGuide` door, which builds the prompt, and the model answer is cut down to links that exist
 * in the map this member may see. The guide only shows the way; it never acts.
 */

/** One question to answer. */
export interface GuideInput {
    readonly question: string
    readonly isManager: boolean
}

const MAX_QUESTION = 500
const MAX_ANSWER = 600
const MAX_STEP = 160
const MAX_STEPS = 5
const MAX_LINKS = 3

const linkTo = (page: GuidePage, text: GuideText): GuideLink => ({
    pageId: page.id,
    label: text.open(text.title(page.id)),
    href: page.path,
    ...(page.target ? { target: page.target } : {}),
})

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

/** The question as the guide reads it: trimmed and bounded. */
const questionOf = (input: GuideInput): string => input.question.trim().slice(0, MAX_QUESTION)

/** The answer from the site map when the question is empty or clearly names a place; null when the model must answer. */
export const mapAnswer = (input: GuideInput, text: GuideText): GuideReply | null => {
    const question = questionOf(input)
    if (!question) return { answer: text.empty, steps: [], links: [], source: "map" }
    // A clear hit costs nothing. Staff asking for a settings page are told who does it.
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
    return null
}

/** The reply the model wrote (null output = it could not answer), cut down to the pages this member may be sent to. */
export const modelAnswer = (output: string | null, isManager: boolean, text: GuideText): GuideReply => {
    const object = output === null ? null : parseObject(output)
    const answer = typeof object?.answer === "string" ? clip(object.answer.trim(), MAX_ANSWER) : ""
    if (!answer) return busyReply(text)
    const allowed = pagesFor(isManager)
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
