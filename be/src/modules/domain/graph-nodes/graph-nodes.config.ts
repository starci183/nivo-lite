import type { EnvSource } from "@modules/platform/config"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"

/** The env key of the flag: `prebuilt:<node id>,<node id>`. Not declared, or empty: every step's agent runs the runner's own JSON loop. */
export const AGENT_LOOP_FLAG = "AGENT_LOOP"

/** The one loop a flag may name. */
const PREBUILT = "prebuilt:"

/** The id of a node (`accounting.match-payment`). */
const NODE_ID = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/u

/** What the flag decides: the nodes whose agent the host's own loop takes the turns of. */
export interface AgentLoopConfig {
    /** The node ids; none means the runner's JSON loop everywhere. */
    readonly nodes: ReadonlyArray<string>
}

/**
 * The node ids of an `AGENT_LOOP` value, or the part of it that cannot be read. Absent or blank names no node. Anything else must be
 * `prebuilt:` followed by node ids separated by commas (blanks around an id are dropped, a repeated id counts once).
 */
export const agentLoopNodesOf = (
    value: string | undefined,
):
    | { readonly kind: "ok"; readonly nodes: ReadonlyArray<string> }
    | { readonly kind: "invalid"; readonly name: string } => {
    const text = (value ?? "").trim()
    if (text === "") return { kind: "ok", nodes: [] }
    if (!text.startsWith(PREBUILT)) return { kind: "invalid", name: text }
    const ids = text
        .slice(PREBUILT.length)
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id !== "")
    const bad = ids.find((id) => !NODE_ID.test(id))
    if (ids.length === 0 || bad !== undefined) return { kind: "invalid", name: bad ?? text }
    return { kind: "ok", nodes: [...new Set(ids)] }
}

/**
 * Reads `AGENT_LOOP`: the nodes whose agent runs on the host's prebuilt loop (default: none, the JSON loop runs every step). A value
 * that is not `prebuilt:<node ids>` throws `GRAPH_NODES_AGENT_LOOP_FLAG_INVALID` naming it, so the app does not start half switched;
 * a well-formed id that is not an installed node is refused when the host starts, which knows the install.
 */
export const parseAgentLoopConfig = (env: EnvSource): AgentLoopConfig => {
    const read = agentLoopNodesOf(env.optional(AGENT_LOOP_FLAG))
    if (read.kind === "invalid") {
        throw new GraphNodesError({ code: GraphNodesErrorCode.AgentLoopFlagInvalid, params: { name: read.name } })
    }
    return { nodes: read.nodes }
}
