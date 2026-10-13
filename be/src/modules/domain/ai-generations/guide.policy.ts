import type { GenMessage, GuideAsk, GuideWords } from "./ai-generations.contracts"

/** One place of the console the guide may send someone to; its words are the `guide.page.<id>.*` catalog keys. */
interface GuidePage {
    readonly id: string
    readonly path: string
    readonly managerOnly: boolean
}

const page = (id: string, path: string, managerOnly = false): GuidePage => ({ id, path, managerOnly })

/** The map of the console (the same ids as the browser's site map, which turns the model's page ids into links). */
const GUIDE_PAGES: ReadonlyArray<GuidePage> = [
    page("office", "/chat"),
    page("overview", "/dashboard"),
    page("authority", "/authority"),
    page("inbox", "/inbox"),
    page("leads", "/leads"),
    page("responsibilities", "/responsibilities"),
    page("decisions", "/decisions"),
    page("automations", "/automations", true),
    page("knowledge", "/knowledge", true),
    page("brain", "/brain"),
    page("modules", "/agents", true),
    page("team", "/team", true),
    page("connections", "/connections", true),
    page("connections.sepay", "/connections", true),
    page("connections.telegram", "/connections", true),
    page("connections.zalo_oa", "/connections", true),
    page("connections.smtp", "/connections", true),
    page("connections.google", "/connections", true),
    page("connections.webhook", "/connections", true),
    page("developers", "/developers", true),
    page("billing", "/billing", true),
    page("account", "/account"),
]

/** Questions are cut to this many characters. */
export const GUIDE_QUESTION_MAX = 500
/** The console path is cut to this many characters. */
export const GUIDE_PATH_MAX = 200
/** At most this many earlier turns reach the model. */
export const GUIDE_HISTORY_TURNS = 6
/** Each earlier turn is cut to this many characters. */
export const GUIDE_TURN_MAX = 300
/** The guide questions one member may send to the model per window. */
export const GUIDE_ASKS_PER_WINDOW = 20
/** The window of the per-member limit, ms. */
export const GUIDE_WINDOW_MS = 10 * 60_000
/** How long the guide waits for the model, ms. */
export const GUIDE_TIMEOUT_MS = 25_000

const clip = (value: string, length: number): string =>
    value.length > length ? `${value.slice(0, length - 1).trimEnd()}...` : value

/** The pages a member with this role may be sent to: staff never see the manager-only ones. */
const pagesFor = (isManager: boolean): ReadonlyArray<GuidePage> =>
    GUIDE_PAGES.filter((entry) => isManager || !entry.managerOnly)

/** The map entry whose path starts the console path (longest wins), for "you are here". */
const pageAt = (path: string): GuidePage | undefined =>
    [...GUIDE_PAGES.filter((entry) => !entry.id.startsWith("connections."))]
        .sort((a, b) => b.path.length - a.path.length)
        .find((entry) => path === entry.path || path.startsWith(`${entry.path}/`))

/** The lock key that serializes the guide questions of one member of one workspace. */
export const guideAskerKey = (workspaceId: string, userId: string): string => `guide:${workspaceId}:${userId}`

/**
 * The prompt of one guide question: the rules and the reply format as the system line, the pages this member may be sent to, where
 * they are, the last turns and the question as the user line. The words come from the catalog in the member's language.
 */
export const guidePrompt = (ask: GuideAsk, isManager: boolean, words: GuideWords): ReadonlyArray<GenMessage> => {
    const title = (id: string): string => words.text(`guide.page.${id}.title`)
    const lines = pagesFor(isManager)
        .map(
            (entry) =>
                `- ${entry.id} | ${title(entry.id)} | ${words.text(`guide.page.${entry.id}.what`)} | ${words.text(`guide.page.${entry.id}.how`)}`,
        )
        .join("\n")
    const path = ask.path.slice(0, GUIDE_PATH_MAX)
    const here = pageAt(path)
    const history = ask.history
        .slice(-GUIDE_HISTORY_TURNS)
        .map((turn) => `${turn.role === "user" ? "User" : "Guide"}: ${clip(turn.text, GUIDE_TURN_MAX)}`)
        .join("\n")
    const user = [
        `PAGES (id | name | what it is for | how):\n${lines}`,
        `CURRENT PAGE: ${here === undefined ? path : `${here.id} (${title(here.id)})`}`,
        history === "" ? "" : `CONVERSATION SO FAR:\n${history}`,
        `QUESTION: ${ask.question.trim().slice(0, GUIDE_QUESTION_MAX)}`,
    ]
        .filter((part) => part !== "")
        .join("\n\n")
    const system = [
        words.text("guide.systemIntro"),
        words.text("guide.systemStyle"),
        words.text("guide.rulesTitle"),
        words.text("guide.rules"),
        `- ${words.text(isManager ? "guide.audienceManager" : "guide.audienceStaff")}`,
        words.text("guide.replyFormat"),
    ].join("\n")
    return [
        { role: "system", content: system },
        { role: "user", content: user },
    ]
}
