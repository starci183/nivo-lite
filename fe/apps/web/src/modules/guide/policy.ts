import { CONSOLE_ROUTES, KNOWLEDGE_ROUTES, brainTabHref } from "@/modules/routes"

/**
 * The per-route rules of "what to do here": plain code over the figures the app already loads, no AI. A rule reads the signals and
 * returns the things worth doing on that page, most important first; the list of a page is the rules of its route in order, cut to
 * MAX_TODOS. Adding a rule for a page is adding it to RULES.
 */

/** A thing of the workspace that needs doing, with where to do it. */
export interface GuideSignalItem {
    readonly id: string
    readonly name: string
    readonly href: string
}

/** The figures the rules read, all from reads the console already makes. */
export interface GuideSignals {
    /** Installed agents that need a connection and have none. */
    readonly agentsWithoutConnection: ReadonlyArray<GuideSignalItem>
    /** Connections that failed and need the owner. */
    readonly failedConnections: ReadonlyArray<GuideSignalItem>
    /** Facts the agents proposed and no one has approved. */
    readonly pendingFacts: number
    /** Findings and customer questions waiting in the Second Brain. */
    readonly openFindings: number
    readonly openQuestions: number
    /** Customers waiting for the owner, and new ones. */
    readonly leadsWaiting: number
    readonly leadsNew: number
    /** Payments that matched no customer. */
    readonly unmatchedPayments: number
    /** Documents that failed to be read. */
    readonly failedDocuments: number
}

/** The kinds of line a todo can be, each a key of the `guide.todo` catalog. */
export type GuideTodoKey =
    | "grantConnection"
    | "fixConnection"
    | "approveFacts"
    | "reviewFindings"
    | "answerQuestions"
    | "answerLeads"
    | "greetLeads"
    | "matchPayments"
    | "retryDocuments"

/** One thing to do on the page. */
export interface GuideTodo {
    readonly id: string
    readonly key: GuideTodoKey
    /** The values the line takes (`name`, `count`). */
    readonly values: Readonly<Record<string, string | number>>
    readonly href: string
    readonly target?: string
}

type Rule = (signals: GuideSignals) => ReadonlyArray<GuideTodo>

/** The most things the page lists. */
export const MAX_TODOS = 5

const counted = (count: number, todo: Omit<GuideTodo, "values">): ReadonlyArray<GuideTodo> =>
    count > 0 ? [{ ...todo, values: { count } }] : []

const grantConnection: Rule = (s) =>
    s.agentsWithoutConnection.map((agent) => ({
        id: `grant-${agent.id}`,
        key: "grantConnection",
        values: { name: agent.name },
        href: agent.href,
        target: "agent.grant",
    }))

const fixConnection: Rule = (s) =>
    s.failedConnections.map((connection) => ({
        id: `fix-${connection.id}`,
        key: "fixConnection",
        values: { name: connection.name },
        href: connection.href,
    }))

const approveFacts: Rule = (s) =>
    counted(s.pendingFacts, { id: "facts", key: "approveFacts", href: brainTabHref("facts"), target: "brain.review" })

const reviewFindings: Rule = (s) =>
    counted(s.openFindings, { id: "findings", key: "reviewFindings", href: brainTabHref("todo") })

const answerQuestions: Rule = (s) =>
    counted(s.openQuestions, { id: "questions", key: "answerQuestions", href: brainTabHref("todo") })

const answerLeads: Rule = (s) =>
    counted(s.leadsWaiting, { id: "leads", key: "answerLeads", href: CONSOLE_ROUTES.inbox })

const greetLeads: Rule = (s) => counted(s.leadsNew, { id: "new", key: "greetLeads", href: CONSOLE_ROUTES.inbox })

const matchPayments: Rule = (s) =>
    counted(s.unmatchedPayments, { id: "unmatched", key: "matchPayments", href: CONSOLE_ROUTES.inbox })

const retryDocuments: Rule = (s) =>
    counted(s.failedDocuments, { id: "documents", key: "retryDocuments", href: KNOWLEDGE_ROUTES.library })

/** The rules of each page, by the first segment of its path; a page that is not listed has none. */
export const RULES: Readonly<Record<string, ReadonlyArray<Rule>>> = {
    overview: [grantConnection, fixConnection, approveFacts, answerLeads, matchPayments],
    inbox: [answerLeads, matchPayments, greetLeads],
    brain: [approveFacts, reviewFindings, answerQuestions, retryDocuments],
    knowledge: [retryDocuments, approveFacts],
    agents: [grantConnection],
    connections: [fixConnection, grantConnection],
    authority: [approveFacts, answerLeads],
}

/** The first segment of a path inside the workspace: `/brain?tab=facts` is `brain`, the workspace root is `overview`. */
export const routeKeyOf = (path: string): string => {
    const segment = path.replace(/^\//u, "").split(/[/?#]/u)[0] ?? ""
    return segment === "" ? "overview" : segment
}

/** The things worth doing on a page, most important first. */
export const todosFor = (path: string, signals: GuideSignals): ReadonlyArray<GuideTodo> =>
    (RULES[routeKeyOf(path)] ?? []).flatMap((rule) => rule(signals)).slice(0, MAX_TODOS)

/** Signals for a workspace whose reads have not answered: nothing to do. */
export const NO_SIGNALS: GuideSignals = {
    agentsWithoutConnection: [],
    failedConnections: [],
    pendingFacts: 0,
    openFindings: 0,
    openQuestions: 0,
    leadsWaiting: 0,
    leadsNew: 0,
    unmatchedPayments: 0,
    failedDocuments: 0,
}
