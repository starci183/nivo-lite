import { graphVocabulary } from "@modules/domain/intent-contracts"
import type { Locale } from "@modules/platform/i18n"
import {
    MAX_DOES_LENGTH,
    MAX_TITLE_LENGTH,
    kindOfStep,
    type GraphDocument,
    type GraphNode,
    type NodeAnswerKey,
    type Say,
    type ToolUse,
} from "../agent-graphs.contracts"
import type { SeedModule } from "../agent-graphs-seed.contracts"

/** The language of the graph being written: the locale that picks a name from the catalogue data and the lookup of the wording. */
export interface Voice {
    /** The language of the workspace. */
    readonly locale: Locale
    /** Looks a sentence of the message catalog up in that language. */
    readonly say: Say
}

const wordsOf =
    (voice: Voice) =>
    (key: string): string =>
        voice.say(`agentGraphs.base.${key}`)

const ANSWERS: ReadonlyArray<NodeAnswerKey> = ["knows", "uses", "reads", "writes", "sources"]

const clipped = (text: string, max: number): string =>
    text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text

/** A node with every answer present: what is empty is marked "None" on purpose, so a seed is never blank. */
const nodeOf = (
    key: string,
    step: GraphNode["step"],
    title: string,
    does: string,
    extra: Partial<GraphNode>,
): GraphNode => {
    const base: GraphNode = {
        key,
        kind: kindOfStep(step),
        step,
        title: clipped(title, MAX_TITLE_LENGTH),
        doneBy: step === "call" ? "agent" : "nivo",
        knows: [],
        does: clipped(does, MAX_DOES_LENGTH),
        uses: [],
        reads: [],
        writes: [],
        approver: null,
        sources: [],
        none: [],
        next: [],
        ...extra,
    }
    return { ...base, none: ANSWERS.filter((answer) => base[answer].length === 0) }
}

const toolsOf = (module: SeedModule): ReadonlyArray<ToolUse> =>
    module.connectionProviders.flatMap((provider) => {
        return graphVocabulary.hasProvider(provider)
            ? [{ provider, tool: null, scope: "read" as const, label: provider }]
            : []
    })

/** A customer message or a request: where the seed starts. */
const startOf = (voice: Voice, next: string): GraphNode => {
    const w = wordsOf(voice)
    return nodeOf("start", "customer_message", w("request"), w("startDoes"), { next: [next] })
}

/** The tag of the agent in Office is a trigger of the graph like any other, not a separate path. */
const tagOf = (voice: Voice, next: string): GraphNode => {
    const w = wordsOf(voice)
    return nodeOf("tag", "tag", w("tagged"), w("taggedDoes"), { next: [next] })
}

/**
 * The base graph of a module for a workspace, derived and never a stored copy: a start node, the tag of the agent, one understand node
 * that uses the module's tools, and one done node. No decide point, approval or act is derived from an authority rule: the rules decide
 * nothing since the engine gate was removed by the owner's rule (2026-11-13; a node's declared mode alone decides).
 */
export const baseGraphOf = (module: SeedModule, voice: Voice): GraphDocument => {
    const w = wordsOf(voice)
    const end = nodeOf("end", "stop", w("end"), w("endDoes"), {})
    const understand = nodeOf("understand", "call", w("understand"), w("understandDoes"), {
        uses: toolsOf(module),
        next: [end.key],
    })
    const nodes = [startOf(voice, understand.key), tagOf(voice, understand.key), understand, end]
    return { nodes }
}
