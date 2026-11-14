import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import type { SpecNode, SpecParam, SpecReadBinding, SpecView } from "@nivo-lite/agent-sdk/spec"
import { dataSetViewOf } from "../../blocks/data-sets.block"
import { DESK_VIEW_ID } from "../../workbench/workbench-spec-problems"
import words from "./agent-desk.words.json"

/*
 * THE DESK TEMPLATE: one composition every agent's workbench opens on (owner, 2026-11-12: "a workbench is that agent's work desk: the
 * visual view to understand what the agent does"). Left: how it works, what waits for a person, what it just did; right: today's
 * counts, what it may touch, the data it works on. Blocks 1 to 5 are generic and read the platform's desk (`platform.agent-desk`);
 * only block 6's list comes from the module. Words are the template's own, in both languages, so every module draws the same desk.
 */

/** The installation a desk read names: the page's own. */
const INSTALLATION = "$installationId"

/** The param the run list marks its chosen row with. */
export const DESK_RUN_PARAM = "run"

/** How many runs the desk lists; the rest are on the runs page ("see all"). */
export const DESK_RECENT_RUNS = 5

/** Where the runs page and the agent's rights are, beside the desk. */
export const DESK_RUNS_PATH = "./work"
export const DESK_RIGHTS_PATH = "./connections"

/** Where one workflow's page is, beside the desk (`{key}` is the workflow key). */
export const DESK_FLOW_PATH = "./workflows/{key}/map"

/** The words of the template by name, as spec text. */
const WORDS: Readonly<Record<keyof typeof words, SpecText>> = words

/** One data set of block 6: a page of the module's own data, counted by the module's ONE counts read when it holds a count. */
export interface DeskDataSet {
    /** The set id: the data page is `./data/<set>`, its view `data-<set>`. */
    readonly set: string
    /** The words of the row. */
    readonly label: SpecText
    /** The path of the set's count in the counts read; absent draws no count. */
    readonly countPath?: string | undefined
    /** The set's count as a sum over a list of the counts read (counts per state); exclusive with `countPath`. */
    readonly countRows?:
        | { readonly path: string; readonly value: string; readonly by?: string; readonly keys?: ReadonlyArray<string> }
        | undefined
    /** A line under the row with `{count}` filled from `hintPath`. */
    readonly hint?: SpecText | undefined
    /** The path of the hint's count in the counts read. */
    readonly hintPath?: string | undefined
}

/** What a module gives the desk: block 6's list, the read that counts it, and the data pages the list opens. */
export interface DeskOfModule {
    /** The sets; none hides block 6. */
    readonly dataSets: ReadonlyArray<DeskDataSet>
    /** The ONE read that counts the sets; absent draws no count. */
    readonly counts?: SpecReadBinding | undefined
    /** The tree of each set's data page, by set id. */
    readonly pages: Readonly<Record<string, SpecNode>>
    /** The params the data pages add (the chosen row of a page's table), by name. */
    readonly params?: Readonly<Record<string, SpecParam>> | undefined
}

/** Block 1: how the agent works, its installed workflows as the canvas's step cards. */
const flowsNode: SpecNode = {
    id: "desk-flows",
    block: "core.agent-flows",
    props: { label: WORDS.flowsLabel, empty: WORDS.flowsEmpty, fact: WORDS.flowsFact, flowPath: DESK_FLOW_PATH },
    bind: { flows: { read: "platform.agent-flows", variables: { installation: INSTALLATION } } },
}

/** Block 2: what waits for a person; "Duyet" is the desk's one primary, "Tu choi" neutral; a stop with no verdict says where it is answered. */
const waitingNode: SpecNode = {
    id: "desk-waiting",
    block: "core.decision-queue",
    props: {
        surface: "card",
        commandSize: "sm",
        label: WORDS.waitingLabel,
        emptyTitle: WORDS.waitingEmptyTitle,
        emptyBody: WORDS.waitingEmptyBody,
        seeWhy: WORDS.waitingSeeWhy,
        moreMenu: WORDS.waitingMore,
        commands: [
            { id: "approve", label: WORDS.approve, intent: "commit" },
            { id: "decline", label: WORDS.decline, intent: "neutral" },
        ],
        elsewhere: WORDS.elsewhere,
    },
    bind: {
        queue: { read: "platform.waiting-on-person", variables: { installation: INSTALLATION } },
        command: { action: "platform.approval-decide" },
    },
}

/** Block 3: what it just did: the question or task, who and when, the records read and changed, how it ended; "see all" opens the runs page. */
const recentNode: SpecNode = {
    id: "desk-recent",
    block: "core.list-card",
    props: {
        label: WORDS.recentLabel,
        title: WORDS.recentLabel,
        empty: WORDS.recentEmpty,
        idPath: "id",
        titlePath: "subject",
        descriptionPath: "facts",
        badgePath: "outcome",
        badgeTones: {
            answered: "neutral",
            changed: "neutral",
            stopped: "neutral",
            failed: "danger",
            running: "neutral",
        },
        labels: {
            outcome: {
                answered: WORDS.outcomeAnswered,
                changed: WORDS.outcomeChanged,
                stopped: WORDS.outcomeStopped,
                failed: WORDS.outcomeFailed,
                running: WORDS.outcomeRunning,
            },
        },
        selectParam: DESK_RUN_PARAM,
        search: false,
        headLink: { label: WORDS.seeAll, path: DESK_RUNS_PATH },
    },
    bind: {
        rows: { read: "platform.agent-runs", variables: { installation: INSTALLATION, limit: DESK_RECENT_RUNS } },
    },
}

/** Block 4: today's counts; records nobody stated draw a dash, never 0. */
const todayNode: SpecNode = {
    id: "desk-today",
    block: "core.figures",
    props: {
        label: WORDS.todayLabel,
        kind: "tiles",
        variant: "ribbon",
        items: [
            { term: WORDS.todayAnswered, path: "answered", format: "count" },
            { term: WORDS.todayRead, path: "recordsRead", format: "tally" },
            { term: WORDS.todayChanged, path: "recordsChanged", format: "tally" },
        ],
    },
    bind: { data: { read: "platform.agent-today", variables: { installation: INSTALLATION } } },
}

/** Block 5: what it may touch, for any provider; the head links to the agent's rights. */
const reachNode: SpecNode = {
    id: "desk-reach",
    block: "core.reach-card",
    props: {
        label: WORDS.reachLabel,
        empty: WORDS.reachEmpty,
        linkLabel: WORDS.reachLink,
        linkPath: DESK_RIGHTS_PATH,
        modes: { auto: WORDS.modeAuto, ask: WORDS.modeAsk, none: WORDS.modeNone },
        states: { connected: WORDS.stateConnected, attention: WORDS.stateAttention, off: WORDS.stateOff },
    },
    bind: { reach: { read: "platform.agent-reach", variables: { installation: INSTALLATION } } },
}

/** Block 6: the data the agent works on, the module's own list; absent when the module lists none (the card is hidden). */
const dataSetsNode = (desk: DeskOfModule): ReadonlyArray<SpecNode> =>
    desk.dataSets.length === 0
        ? []
        : [
              {
                  id: "desk-data",
                  block: "core.data-sets",
                  props: {
                      label: WORDS.dataLabel,
                      openLabel: WORDS.dataOpen,
                      items: desk.dataSets.map((entry) => ({
                          set: entry.set,
                          label: entry.label,
                          ...(entry.countPath === undefined ? {} : { countPath: entry.countPath }),
                          ...(entry.countRows === undefined ? {} : { countRows: { ...entry.countRows } }),
                          ...(entry.hint === undefined ? {} : { hint: entry.hint }),
                          ...(entry.hintPath === undefined ? {} : { hintPath: entry.hintPath }),
                      })),
                  },
                  ...(desk.counts === undefined ? {} : { bind: { counts: desk.counts } }),
              },
          ]

/** The desk view of a module: the two columns in the well, the right one folding under the left on a phone. */
export const agentDeskViewOf = (desk: DeskOfModule): SpecView => ({
    id: DESK_VIEW_ID,
    label: WORDS.tab,
    root: {
        id: "desk",
        block: "core.aside-detail",
        props: { width: "wide" },
        children: [
            {
                id: "desk-main",
                block: "core.stack",
                props: { gap: "section" },
                children: [flowsNode, waitingNode, recentNode],
            },
            {
                id: "desk-rail",
                block: "core.stack",
                props: { gap: "section" },
                children: [todayNode, reachNode, ...dataSetsNode(desk)],
            },
        ],
    },
})

/** The data page of one set: hidden (no tab), opened by its own route, drawing the module's tree. */
const dataPageOf = (set: string, label: SpecText, root: SpecNode): SpecView => ({
    id: dataSetViewOf(set),
    label,
    hidden: true,
    root,
})

/** The words a data page shows when its table is empty or nothing is chosen. */
interface DataPageWords {
    /** The words of an empty table. */
    readonly empty: SpecText
    /** The words of a detail with nothing chosen. */
    readonly idle: SpecText
}

/** The words of a data page's table and detail when it is empty or nothing is chosen. */
export const DATA_PAGE_WORDS: DataPageWords = {
    empty: WORDS.dataPageEmpty,
    idle: WORDS.dataPageIdle,
}

/** The param the desk's run list marks its row with, added to a module that has none of that name. */
const RUN_PARAM: SpecParam = { type: "string", url: DESK_RUN_PARAM }

/** A spec document as its JSON holds it, before it is parsed. */
interface RawSpec {
    readonly params?: Readonly<Record<string, unknown>> | undefined
    readonly views: ReadonlyArray<unknown>
}

/**
 * A module's workbench spec with the desk FIRST, the module's own views after it, then the data pages of block 6 (hidden). The run param
 * the desk's list marks is added when the module has none of that name.
 */
export const withAgentDesk = (spec: RawSpec, desk: DeskOfModule): RawSpec => {
    const params = { ...spec.params, ...desk.params }
    const pages = desk.dataSets.flatMap((entry) => {
        const root = desk.pages[entry.set]
        return root === undefined ? [] : [dataPageOf(entry.set, entry.label, root)]
    })
    return {
        ...spec,
        params: params[DESK_RUN_PARAM] === undefined ? { ...params, [DESK_RUN_PARAM]: RUN_PARAM } : params,
        views: [agentDeskViewOf(desk), ...spec.views, ...pages],
    }
}

/** The views of a module's spec, as far as `viewNodeOf` reads them. */
interface ViewsOwner {
    /** The views of the spec. */
    readonly views: ReadonlyArray<unknown>
}

/** Whether a value is the block node of the given id. */
const isViewNode = (node: object, id: string): node is SpecNode => "id" in node && node.id === id && "block" in node

/** A node of a module's own views, by id, to draw again as a data page: the page shows the module's own table, never a copy written twice. */
export const viewNodeOf = (spec: ViewsOwner, id: string): SpecNode => {
    const find = (node: unknown): SpecNode | null => {
        if (typeof node !== "object" || node === null) return null
        if (isViewNode(node, id)) return node
        const children = "children" in node && Array.isArray(node.children) ? node.children : []
        for (const child of children) {
            const found = find(child)
            if (found !== null) return found
        }
        return null
    }
    for (const view of spec.views) {
        const found = typeof view === "object" && view !== null && "root" in view ? find(view.root) : null
        if (found !== null) return found
    }
    throw new Error(`no node ${id} in the views of the spec`)
}
