import { Injectable } from "@nestjs/common"
import { ContextReadsService, NOTE_ROWS, ORDER_ROWS, boundedLimitOf } from "@modules/domain/context-sources"
import type { ContextAudience, LockedSubject } from "@modules/domain/context-sources"
import type { GatewayJson, NativeToolSpec } from "@modules/domain/mcp-gateway"
import { argumentsOf, unknownTool } from "@modules/domain/mcp-gateway"
import {
    LEAD_NOTE_LIST_INPUT_SCHEMA,
    LEAD_NOTE_LIST_SCHEMA,
    LEAD_ORDER_LIST_INPUT_SCHEMA,
    LEAD_ORDER_LIST_SCHEMA,
    LEAD_PROFILE_GET_INPUT_SCHEMA,
    LEAD_PROFILE_GET_SCHEMA,
} from "./context-native.schema"

/** The tools of the customer source, as the `nivo` connector lists them. */
export const LEAD_TOOLS: ReadonlyArray<NativeToolSpec> = [
    {
        name: "lead.profile.get",
        description:
            "The customer this run serves: name, contact and what the shop's workflows remember of them. Takes no customer id.",
        scope: "read",
        defaultMode: "auto",
        inputSchema: LEAD_PROFILE_GET_INPUT_SCHEMA,
        argumentSchema: LEAD_PROFILE_GET_SCHEMA,
        secretFields: ["notice", "contactName", "phone", "email", "remembered"],
    },
    {
        name: "lead.order.list",
        description:
            "The latest orders of the customer this run serves, newest first, with their status and how each delivery goes. Takes no customer id.",
        scope: "read",
        defaultMode: "auto",
        inputSchema: LEAD_ORDER_LIST_INPUT_SCHEMA,
        argumentSchema: LEAD_ORDER_LIST_SCHEMA,
        secretFields: ["notice", "recipientName", "recipientPhone", "deliveryAddress", "note"],
    },
    {
        name: "lead.note.list",
        description:
            "What the shop's workflow steps noted about the customer this run serves, newest first. Takes no customer id.",
        scope: "read",
        defaultMode: "auto",
        inputSchema: LEAD_NOTE_LIST_INPUT_SCHEMA,
        argumentSchema: LEAD_NOTE_LIST_SCHEMA,
        secretFields: ["notice", "output"],
    },
]

@Injectable()
/**
 * The customer source of the `nivo` connector: the record, the latest orders and the notes of the customer the run serves, read for the
 * subject the connector fixed (the run's own customer, never another) and the caller's audience (a customer-facing run reads no
 * shop-internal field). A run with no customer reads nothing.
 */
export class LeadNativeService {
    readonly tools: ReadonlyArray<NativeToolSpec> = LEAD_TOOLS

    constructor(private readonly reads: ContextReadsService) {}

    /** Runs one tool of the source for the locked subject and the caller's audience. */
    async read(
        workspaceId: string,
        tool: string,
        args: GatewayJson,
        subject: LockedSubject,
        audience: ContextAudience,
    ): Promise<GatewayJson> {
        if (tool === "lead.profile.get") {
            argumentsOf(tool, LEAD_PROFILE_GET_SCHEMA, args)
            return { ...(await this.reads.profile(workspaceId, subject, audience)) }
        }
        if (tool === "lead.order.list") {
            const input = argumentsOf(tool, LEAD_ORDER_LIST_SCHEMA, args)
            const limit = boundedLimitOf(input.limit, ORDER_ROWS)
            return { ...(await this.reads.orders(workspaceId, subject, audience, limit)) }
        }
        if (tool === "lead.note.list") {
            const input = argumentsOf(tool, LEAD_NOTE_LIST_SCHEMA, args)
            const limit = boundedLimitOf(input.limit, NOTE_ROWS)
            return { ...(await this.reads.notes(workspaceId, subject, audience, limit)) }
        }
        throw unknownTool(tool)
    }
}
