import type { DoorCallResult } from "@nivo-lite/agent-sdk/mutation"
import { TOOL } from "@nivo-lite/agent-sdk/names"

/**
 * The door tools a declared job may call, as data: exactly the tools the declared jobs of the modules call (the `tools` of their module
 * declarations). Every other tool is default deny. The customer send is among them:
 * a job that tells a person something (a reply a member typed, an approved draft, a payment notice) says it with the one send tool, under
 * the same rights check, delivery ledger and receipt as a step.
 */
export const DOOR_GRANTS: ReadonlyArray<string> = [
    TOOL.customerMessageSend,
    TOOL.teamChatReportPost,
    TOOL.ledgerEntryAppend,
    TOOL.ledgerStatusGet,
]

/**
 * The granted tools that are the VOICE of an agent: the rights judge reads the calling agent's attachment to the account the person is
 * reached through, so the job calls them as the installed agent of its own module (the one its records belong to), never as the
 * internal agent, which is attached to no account. A job that reaches no records has no such agent and is refused.
 */
export const SPOKEN_AS_MODULE_AGENT: ReadonlyArray<string> = [TOOL.customerMessageSend]

/** The module key of the internal agent: the workspace row seeds one `agents` row of this module (its grants are the gateway names of `DOOR_GRANTS`). */
export const NIVO_AGENT_MODULE = "nivo"

/** Whether the internal agent holds this door tool. */
export const isDoorGranted = (tool: string): boolean => DOOR_GRANTS.includes(tool)

/** Whether the tool is the voice of the job's own module agent. */
export const isSpokenAsModuleAgent = (tool: string): boolean => SPOKEN_AS_MODULE_AGENT.includes(tool)

/** The answer for a spoken tool called by a job whose module has no installed agent that could speak. */
export const NO_SPEAKER: DoorCallResult = { ok: false, reason: "forbidden", message: "no_agent" }

/** The answer for a door tool the internal agent does not hold. */
export const NOT_GRANTED: DoorCallResult = { ok: false, reason: "forbidden", message: "not_granted" }
