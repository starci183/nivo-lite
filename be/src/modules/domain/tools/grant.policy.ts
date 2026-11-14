import { DEFAULT_AI_READ_TOOLS, DEFAULT_NODE_TOOLS } from "@nivo-lite/agent-sdk/names"
import { isDefaultRead } from "@modules/domain/context-sources"
import { NIVO_TOOL_PREFIX } from "./tool-name.policy"
import type { ToolCaller, ManifestTool, GrantVerdict, ToolGrant } from "./tools.contracts"
import type { ModeVerdict } from "./node-mode.policy"

/** The connectors whose read tools every agent of a workspace holds with no grant row: the second brain. */
const DEFAULT_READ_CONNECTORS: ReadonlySet<string> = new Set(["brain"])

/** The public prefix whose next segment names the connector: `nivo.tool.brain.search` is the brain's. */
const NAMESPACE = `${NIVO_TOOL_PREFIX}.`

/** The family a full tool name belongs to: the segment after `nivo.tool.`, else the first segment (a source key). */
export const familyOfTool = (tool: string): string =>
    (tool.startsWith(NAMESPACE) ? tool.slice(NAMESPACE.length) : tool).split(".", 1).join("")

/**
 * True for a tool every agent holds by default (owner rules 2026-11-10: "the second brain MCP is granted to agents by default"): a READ
 * tool of the second brain or a read of a registered context source, and a tool that only FILES A REQUEST a person then decides
 * (`filesRequest`). What a read may see is not decided here: the caller's audience lens and the door's lock still narrow it.
 */
export const grantedByDefault = (spec: ManifestTool, name: string): boolean =>
    (spec.scope === "read" && (DEFAULT_READ_CONNECTORS.has(familyOfTool(name)) || isDefaultRead(name))) ||
    spec.filesRequest === true

/**
 * The tools a workflow step holds without its node listing them (owner): the record and file tools of every node and the read-context
 * tools of every AI step (`@nivo-lite/agent-sdk/names`). The SDK's runner tells the node's code from its AI step; the door holds both.
 */
const STEP_DEFAULTS: ReadonlySet<string> = new Set<string>([...DEFAULT_NODE_TOOLS, ...DEFAULT_AI_READ_TOOLS])

/** True for a tool a step may call although its node does not list it (`STEP_DEFAULTS`). */
export const isStepDefault = (name: string): boolean => STEP_DEFAULTS.has(name)

/** A grant row as a road outside every node reads it: its mode word, `auto` or `ask`; any other word (an old `never`) is no row. */
const usableRow = (row: ToolGrant | null): ToolGrant | null => (row?.mode === "auto" || row?.mode === "ask" ? row : null)

/**
 * The grant a call runs under (nivo-frame `rights`):
 * - a workflow STEP: the tool must be on the step's allow-list (its node declares it) or a step default (`isStepDefault`); its MODE is the node's (`modeVerdictOf`), never a
 *   row's;
 * - the engine's own call: it runs;
 * - a road outside every node: a READ needs a grant row (or a default read), default deny; a WRITE asks unless a person approved it (the
 *   outside default of `modeVerdictOf`), whatever a row says; a write that only files a request a person decides runs.
 * No `never`, no limit, no constraint, no amount is read: those were removed.
 */
export const grantVerdictOf = (
    row: ToolGrant | null,
    spec: ManifestTool,
    caller: ToolCaller,
    name: string,
    mode: ModeVerdict,
    road: "step" | "engine" | "outside",
): GrantVerdict => {
    if (road === "step" && caller.run !== undefined && !caller.run.stepTools.includes(name) && !isStepDefault(name))
        return { kind: "refuse" }
    if (road === "outside") {
        // A READ outside every node needs a row or a default read (default deny); a write asks (or runs once approved). A write that only
        // files a request a person then decides (`filesRequest`) runs: that person's decision is its approval.
        if (spec.scope === "read") return usableRow(row) === null && !grantedByDefault(spec, name) ? { kind: "refuse" } : { kind: "allow" }
        if (spec.filesRequest === true) return { kind: "allow" }
    }
    if (mode.kind === "refuse") return { kind: "refuse" }
    if (mode.kind === "ask") return { kind: "approval", reason: mode.reason }
    return { kind: "allow" }
}
