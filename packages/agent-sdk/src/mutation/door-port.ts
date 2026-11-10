import { z } from "../schema/zod-entry"
import type { JsonValue } from "../schema/schema.types"
import { definePort } from "../port/port"
import type { PortDefinition } from "../port/port.types"

/** The port id of the door: calling a NIVO MCP tool from a job (plan section 9.1). Never inside a transaction (BE-PERSISTENCE-6, R82). */
export const DOOR_PORT_ID = "engine.door"

/**
 * A door tool: a domain tool `<group>.<action>` (`nivo.chat.send`, `nivo.ledger.entry.append`), whose provider the door resolves from the workspace's
 * connection, or a provider-qualified `<group>.<provider>.<action>` (`ai.agent.turn`, `chat.zalo.send`). NIVO's own tools after the
 * rename are domain tools too, three or four parts under `nivo.` (`nivo.chat.send`, `nivo.ledger.entry.append`): the door resolves
 * them by the full id a connector declares as its `domain`, never by dropping a part.
 */
export type DoorTool = `${string}.${string}`

/** A NIVO tool after the rename: `nivo.<domain>.<verb>` or `nivo.<domain>.<object>.<verb>`. */
const NIVO_TOOL = /^nivo(\.[a-z][a-z0-9-]*){1,2}\.[a-z][a-zA-Z0-9-]*$/

const DOOR_TOOL = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)?\.[a-z][a-zA-Z0-9-]*$/

const DOMAIN_TOOL = /^[a-z][a-z0-9-]*\.[a-z][a-zA-Z0-9-]*$/

/** The zod schema of a door tool name. */
export const doorToolSchema: z.ZodType<string> = z
    .string()
    .max(120)
    .refine((tool) => DOOR_TOOL.test(tool) || NIVO_TOOL.test(tool))

/** Whether a string is a well-formed door tool name. */
export const isDoorTool = (tool: string): tool is DoorTool => doorToolSchema.safeParse(tool).success

/**
 * Whether a door tool is a domain tool `<group>.<action>` or a NIVO tool `nivo.…`: the door, not the caller, picks the provider that
 * plays it, by the full id.
 */
export const isDomainTool = (tool: string): boolean => DOMAIN_TOOL.test(tool) || NIVO_TOOL.test(tool)

/** Why a door call did not return output: the tool is unknown, the input invalid, the call not allowed, or the provider failed (transient is retried). */
export type DoorFailure = "unknown_tool" | "invalid" | "forbidden" | "transient" | "failed"

/** What a door call answers: the tool output, or why it did not produce any. */
export type DoorCallResult =
    | { readonly ok: true; readonly output: JsonValue }
    | { readonly ok: false; readonly reason: DoorFailure; readonly message: string }

/** The api of the door port. */
export interface DoorApi {
    /** Calls the tool with the input and answers its output or a failure; never inside a transaction. */
    call(tool: DoorTool, input: Readonly<Record<string, JsonValue>>): Promise<DoorCallResult>
}

/** The door port declaration a job lists in its ports. */
export const doorPort: PortDefinition<DoorApi> = definePort<DoorApi>(DOOR_PORT_ID)
