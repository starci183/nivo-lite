import { z } from "../schema/zod-entry"
import type { JsonValue } from "../schema/schema.types"
import { isToolId } from "../schema/namespaced"
import { definePort } from "../port/port"
import type { PortDefinition } from "../port/port.types"

/** The port id of the door: calling a NIVO MCP tool from a job (plan section 9.1). Never inside a transaction (BE-PERSISTENCE-6, R82). */
export const DOOR_PORT_ID = "engine.door"

/**
 * A door tool: a domain tool `<group>.<action>`, whose provider the door resolves from the workspace's connection, or a
 * provider-qualified `<group>.<provider>.<action>` (`ai.agent.turn`, `chat.zalo.send`). NIVO's own tools are domain tools too, by the
 * law of a NIVO tool id (`nivo.tool.customer.message.send`, `nivo.tool.ledger.entry.append`): the door resolves them by the full id a connector
 * declares as its `domain`, never by dropping a part.
 */
export type DoorTool = `${string}.${string}`

const DOOR_TOOL = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)?\.[a-z][a-zA-Z0-9-]*$/

const DOMAIN_TOOL = /^[a-z][a-z0-9-]*\.[a-z][a-zA-Z0-9-]*$/

/** The zod schema of a door tool name. */
export const doorToolSchema: z.ZodType<string> = z
    .string()
    .max(120)
    .refine((tool) => (tool.startsWith("nivo.") ? isToolId(tool) : DOOR_TOOL.test(tool)))

/** Whether a string is a well-formed door tool name. */
export const isDoorTool = (tool: string): tool is DoorTool => doorToolSchema.safeParse(tool).success

/**
 * Whether a door tool is a domain tool `<group>.<action>` or a NIVO tool `nivo.tool....`: the door, not the caller, picks the provider that
 * plays it, by the full id.
 */
export const isDomainTool = (tool: string): boolean => (tool.startsWith("nivo.") ? isToolId(tool) : DOMAIN_TOOL.test(tool))

/** Why a door call did not return output: the tool is unknown, the input invalid, the call not allowed, or the provider failed (transient is retried). */
export type DoorFailure = "unknown_tool" | "invalid" | "forbidden" | "transient" | "failed"

/** What a door call answers: the tool output, or why it did not produce any. */
export type DoorCallResult =
    | { readonly ok: true; readonly output: JsonValue }
    | { readonly ok: false; readonly reason: DoorFailure; readonly message: string }

/** What a job says about ONE door call beside its input. */
export interface DoorCallOptions {
    /**
     * The business key of the effect: one effect per key in the workspace, whichever job asks (the `onceBy` of a graph step). Left out, the
     * call is kept once per job run and arguments (the job's effect key joined to the hash of the input).
     */
    readonly onceBy?: string | undefined
    /**
     * The customer route the job serves (`customer_routes.id`), when it answers on one: the call is then a reply on that route (the
     * engine reads the person, channel and account from the route, and no other route is reachable by it). Left out, the call names
     * its person in its input and is a message of its own.
     */
    readonly routeId?: string | undefined
    /** The member of the shop who typed what the call says, recorded on the customer line (a person's typed reply). */
    readonly byMember?: string | undefined
}

/** The api of the door port. */
export interface DoorApi {
    /** Calls the tool with the input and answers its output or a failure; never inside a transaction. */
    call(tool: DoorTool, input: Readonly<Record<string, JsonValue>>, options?: DoorCallOptions): Promise<DoorCallResult>
}

/** The door port declaration a job lists in its ports. */
export const doorPort: PortDefinition<DoorApi> = definePort<DoorApi>(DOOR_PORT_ID)
