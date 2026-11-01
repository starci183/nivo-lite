import type { AgentGraphDecideForm, AgentGraphFactData, AgentGraphRowForm } from "@/modules/types"
import { conditionOfTerms } from "./agent-graph-condition"
import { KEEP_GROUP } from "./agent-graph-decide-form"
import type {
    AgentGraphWireApprover,
    AgentGraphWireBranch,
    AgentGraphWireDocument,
    AgentGraphWireNode,
} from "./agent-graph-wire"

/** The words of the nodes the owner's edit may add to the graph: written by the hook in the language of the reader. */
export interface AgentGraphNodeTexts {
    readonly decideTitle: string
    readonly decideDoes: string
    readonly askTitle: string
    readonly askDoes: string
    readonly stopTitle: string
    readonly stopDoes: string
}

/** What writing a decision point into the draft needs to know. */
export interface AgentGraphWriteContext {
    readonly facts: ReadonlyArray<AgentGraphFactData>
    readonly texts: AgentGraphNodeTexts
}

/** The answers a node the owner adds leaves as "None" on purpose, so no answer is blank. */
const ALL_NONE = ["knows", "uses", "reads", "writes", "sources"]

const groupOf = (memberId: string) => ({ roles: [], rooms: [], members: memberId === "" ? [] : [memberId] })

/** The approver a branch asks, keeping the policy it had; null when it does not ask or names nobody. */
const approverOf = (row: AgentGraphRowForm, before: AgentGraphWireApprover | null): AgentGraphWireApprover | null => {
    if (row.then !== "ask" || row.approverId === "") return null
    const group = row.approverId === KEEP_GROUP ? (before?.group ?? groupOf("")) : groupOf(row.approverId)
    const backup =
        row.backupId === "" ? { kind: "unset" as const } : { kind: "backup" as const, group: groupOf(row.backupId) }
    return {
        group,
        policy: before?.policy ?? "any",
        timeoutMinutes: Math.max(1, row.timeoutHours) * 60,
        onTimeout: row.onTimeout === "backup" ? backup : { kind: row.onTimeout },
    }
}

/** The words of a node the owner's edit adds. */
interface AddedWords {
    readonly title: string
    readonly does: string
}

/** A node the owner's edit adds: every answer given, "None" where there is nothing. */
const addedNode = (
    key: string,
    step: "approval" | "stop" | "evaluate",
    words: AddedWords,
    extra: Partial<AgentGraphWireNode>,
): AgentGraphWireNode => ({
    key,
    kind: step === "evaluate" ? "condition" : "output",
    step,
    title: words.title,
    doneBy: step === "approval" ? "person" : "nivo",
    knows: [],
    does: words.does,
    uses: [],
    reads: [],
    writes: [],
    approver: null,
    sources: [],
    none: ALL_NONE,
    next: [],
    ...extra,
})

/** The longest a title of a step may be: the back end refuses a longer one. */
const MAX_TITLE = 28

/** The title of a decision point: what it does and the action it guards, cut to what a title may hold. */
const titled = (what: string, action: string): string => {
    const title = `${what} · ${action}`
    return title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1).trimEnd()}…` : title
}

/** The first key of `${prefix}${n}` that nothing holds, remembered as held. */
const freshKey = (held: Set<string>, prefix: string): string => {
    let n = 1
    while (held.has(`${prefix}${n}`)) n += 1
    held.add(`${prefix}${n}`)
    return `${prefix}${n}`
}

/** The conditions a group holds: an `all` or an `any`; nothing for any other shape. */
const membersOfWhen = (when: object): unknown => {
    if ("all" in when) return when.all
    return "any" in when ? when.any : []
}

/** Every fact a condition names, however deep. */
const factsOfWhen = (when: unknown): ReadonlyArray<string> => {
    if (typeof when !== "object" || when === null) return []
    if ("fact" in when && typeof when.fact === "string") return [when.fact]
    const members = membersOfWhen(when)
    return Array.isArray(members) ? members.flatMap(factsOfWhen) : []
}

/** The keys a node leads to, for a decision point its branches' and for the others its `next`. */
const successorsOf = (node: AgentGraphWireNode): ReadonlyArray<string> =>
    node.decide === undefined ? node.next : node.decide.branches.map((branch) => branch.next)

/**
 * The graph without the steps no trigger leads to. An edit that moves a branch away from an approval leaves that approval alone
 * in the graph, and publishing refuses a step nobody reaches, so the edit takes it out with the branch that used it.
 */
export const pruneUnreachable = (document: AgentGraphWireDocument): AgentGraphWireDocument => {
    const byKey = new Map(document.nodes.map((node) => [node.key, node]))
    const reached = new Set<string>()
    const queue = document.nodes.filter((node) => node.kind === "trigger").map((node) => node.key)
    for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
        const node = byKey.get(key)
        if (node !== undefined && !reached.has(key)) {
            reached.add(key)
            queue.push(...successorsOf(node))
        }
    }
    return reached.size === 0
        ? document
        : { ...document, nodes: document.nodes.filter((node) => node.kind === "trigger" || reached.has(node.key)) }
}

/** An approval step a branch leads to: the step when it exists already, and the approver it holds. */
interface AskStep {
    readonly node: AgentGraphWireNode | undefined
    readonly approver: AgentGraphWireApprover | null
}

/** The branches of the form written as branches of the draft, with the approval steps they lead to. */
interface WrittenBranches {
    readonly branches: ReadonlyArray<AgentGraphWireBranch>
    readonly asks: ReadonlyMap<string, AskStep>
}

const writeBranches = (
    document: AgentGraphWireDocument,
    node: AgentGraphWireNode,
    form: AgentGraphDecideForm,
    context: AgentGraphWriteContext,
): WrittenBranches | null => {
    const { decide } = node
    if (decide === undefined) return null
    const intent = decide.intent
    const byKey = new Map(document.nodes.map((entry) => [entry.key, entry]))
    const act = document.nodes.find((entry) => entry.step === "write" && entry.action === intent)
    const stopKey = `stop:${intent}`
    const held = new Set([...form.rows.map((row) => row.key).filter((key) => key !== ""), ...byKey.keys()])
    const claimed = new Set<string>()
    const asks = new Map<string, AskStep>()
    const askKeyOf = (key: string, before: AgentGraphWireBranch | undefined): string => {
        const reusable = before === undefined ? undefined : byKey.get(before.next)
        if (reusable?.step === "approval" && !claimed.has(reusable.key)) return reusable.key
        let own = `ask:${intent}:${key}`
        while (held.has(own)) own = `${own}:x`
        held.add(own)
        return own
    }
    const whenOf = (row: AgentGraphRowForm, before: AgentGraphWireBranch | undefined): unknown => {
        if (row.isElse) return "else"
        return row.isLocked ? (before?.when ?? "else") : conditionOfTerms(row.terms, context.facts)
    }
    const branches = form.rows.map((row): AgentGraphWireBranch => {
        const before = decide.branches.find((entry) => entry.key === row.key)
        const key = row.key === "" ? freshKey(held, "b") : row.key
        const approver = approverOf(row, before?.approver ?? null)
        const when = whenOf(row, before)
        const next = (() => {
            if (row.then === "auto") return act?.key ?? before?.next ?? stopKey
            if (row.then === "stop") return stopKey
            const askKey = askKeyOf(key, before)
            claimed.add(askKey)
            asks.set(askKey, { node: byKey.get(askKey), approver })
            return askKey
        })()
        const isChanged =
            before === undefined ||
            JSON.stringify([before.when, before.then, before.approver]) !== JSON.stringify([when, row.then, approver])
        return {
            key,
            when,
            then: row.then,
            next,
            approver,
            sources: before?.sources ?? [],
            selfCorrected: isChanged ? true : before?.selfCorrected === true,
        }
    })
    return { branches, asks }
}

/** The facts a decision point reads once its branches are written: the ones it had that are still used, then the new ones. */
const factsOfBranches = (
    before: ReadonlyArray<string>,
    branches: ReadonlyArray<AgentGraphWireBranch>,
): ReadonlyArray<string> => {
    const used = branches.flatMap((branch) => factsOfWhen(branch.when))
    return [...new Set([...before.filter((fact) => used.includes(fact)), ...used])]
}

/**
 * The draft after the owner saved a decision point: its branches (the condition rows, the action, the approver) and the steps they
 * lead to. A branch that asks leads to an approval step of its own, so each person asked is held by one step; the steps no branch
 * leads to any more are taken out. Nothing else of the graph changes.
 */
export const documentWithDecide = (
    document: AgentGraphWireDocument,
    form: AgentGraphDecideForm,
    context: AgentGraphWriteContext,
): AgentGraphWireDocument => {
    const node = document.nodes.find((entry) => entry.key === form.nodeKey)
    const written = node === undefined ? null : writeBranches(document, node, form, context)
    if (node?.decide === undefined || written === null) return document
    const { decide } = node
    const act = document.nodes.find((entry) => entry.step === "write" && entry.action === decide.intent)
    const stopKey = `stop:${decide.intent}`
    const needsStop =
        written.branches.some((branch) => branch.next === stopKey) &&
        !document.nodes.some((entry) => entry.key === stopKey)
    const added = [
        ...(needsStop
            ? [addedNode(stopKey, "stop", { title: context.texts.stopTitle, does: context.texts.stopDoes }, {})]
            : []),
        ...[...written.asks.entries()].flatMap(([key, ask]) =>
            ask.node === undefined
                ? [
                      addedNode(
                          key,
                          "approval",
                          { title: context.texts.askTitle, does: context.texts.askDoes },
                          { approver: ask.approver, next: act === undefined ? [] : [act.key] },
                      ),
                  ]
                : [],
        ),
    ]
    const rewritten = document.nodes.flatMap((entry): ReadonlyArray<AgentGraphWireNode> => {
        if (entry.key === node.key)
            return [
                {
                    ...entry,
                    decide: {
                        ...decide,
                        facts: [...factsOfBranches(decide.facts, written.branches)],
                        branches: [...written.branches],
                    },
                },
                ...added,
            ]
        const ask = written.asks.get(entry.key)
        return [ask === undefined ? entry : { ...entry, approver: ask.approver }]
    })
    return pruneUnreachable({ ...document, nodes: rewritten })
}

/** The actions of the graph a decision point can still be added to: what a node writes, with no decision point in front of it. */
export const unguardedActionsOf = (document: AgentGraphWireDocument): ReadonlyArray<AgentGraphWireNode> =>
    document.nodes.filter(
        (entry) =>
            entry.step === "write" &&
            entry.action !== undefined &&
            !document.nodes.some((other) => other.decide?.intent === entry.action),
    )

/** The group a new decision point asks until the owner names a person: the owner and the managers, as the rule of the action did. */
const DEFAULT_ASKED = { roles: ["owner", "manager"], rooms: [], members: [] }

/**
 * The draft with a decision point in front of an action: under the first amount the action runs alone, and in every other case
 * (the closing "else", which never runs alone) the owner and managers are asked, through the approval the action already had.
 * Everything that led to the action now leads to the decision point. The owner then edits its rows.
 */
export const documentWithDecidePoint = (
    document: AgentGraphWireDocument,
    action: string,
    fact: AgentGraphFactData,
    context: AgentGraphWriteContext,
): AgentGraphWireDocument | null => {
    const act = document.nodes.find((entry) => entry.step === "write" && entry.action === action)
    if (act === undefined || document.nodes.some((entry) => entry.decide?.intent === action)) return null
    const approval = document.nodes.find((entry) => entry.key === `ask:${action}` && entry.step === "approval")
    const head = approval ?? act
    const decideKey = `decide:${action}`
    const askKey = approval?.key ?? `ask:${action}`
    const approver: AgentGraphWireApprover = approval?.approver ?? {
        group: DEFAULT_ASKED,
        policy: "any",
        timeoutMinutes: 240,
        onTimeout: { kind: "agent_owner" },
    }
    const small = fact.unit === "vnd" ? 5_000_000 : 1
    const branches: Array<AgentGraphWireBranch> = [
        {
            key: "b1",
            when: { fact: fact.key, op: "lt", value: small },
            then: "auto",
            next: act.key,
            approver: null,
            sources: [],
            selfCorrected: true,
        },
        { key: "else", when: "else", then: "ask", next: askKey, approver, sources: [], selfCorrected: true },
    ]
    const decide = addedNode(
        decideKey,
        "evaluate",
        { title: titled(context.texts.decideTitle, act.title), does: context.texts.decideDoes },
        {
            sources: [{ kind: "rule", action }],
            none: ALL_NONE.filter((answer) => answer !== "sources"),
            decide: { intent: action, facts: [fact.key], branches },
        },
    )
    const askNode =
        approval === undefined
            ? [
                  addedNode(
                      askKey,
                      "approval",
                      { title: context.texts.askTitle, does: context.texts.askDoes },
                      { approver, next: [act.key] },
                  ),
              ]
            : []
    const nodes = document.nodes.flatMap((entry): ReadonlyArray<AgentGraphWireNode> => {
        const leadsToHead = entry.next.includes(head.key)
        const moved = leadsToHead
            ? { ...entry, next: entry.next.map((key) => (key === head.key ? decideKey : key)) }
            : entry
        return entry.key === head.key ? [decide, ...askNode, moved] : [moved]
    })
    return pruneUnreachable({ ...document, nodes })
}
