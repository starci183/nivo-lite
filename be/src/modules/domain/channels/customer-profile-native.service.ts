import { Injectable } from "@nestjs/common"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import { nativeRefusal } from "@modules/domain/native-tools/native-refusal.policy"
import { ChannelProfileRegistryService } from "@modules/domain/provider-registry"
import {
    argumentsOf,
    unknownTool,
    type NativeCaller,
    type NativeToolFamily,
    type ToolJson,
    type ToolManifest,
} from "@modules/domain/tools"
import { CUSTOMER_PROFILE_GET_INPUT_SCHEMA, CUSTOMER_PROFILE_GET_SCHEMA } from "./customer-profile-native.schema"

/** The tool of the connector, by its own name (`nivo.tool.customer.profile.get`). */
export const CUSTOMER_PROFILE_TOOL = { get: "get" } as const

/** The native connector of what a channel says of a person on it (name and picture), read-only. */
export const CUSTOMER_PROFILE_MANIFEST: ToolManifest = {
    key: "customer-profile",
    namespace: "nivo.tool.customer.profile",
    name: "Customer profile",
    contractVersion: "customer-profile@1",
    tools: [
        {
            name: CUSTOMER_PROFILE_TOOL.get,
            description:
                "What the channel says of one person on a channel account: their display name and picture link, each an empty text when the channel gives none (a message event carries neither). Reads only: it keeps nothing and changes no contact.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: CUSTOMER_PROFILE_GET_INPUT_SCHEMA,
            argumentSchema: CUSTOMER_PROFILE_GET_SCHEMA,
        },
    ],
}

@Injectable()
/**
 * The provider-neutral get-profile tool: finds the provider of the channel account in the workspace and asks the profile port that
 * provider registered (its one API operation "get the profile of a person"), the way the send picks its channel's sender. It reads and
 * writes no contact and no chat; the caller keeps what it wants of the answer. A provider that registered no profile read, or a channel
 * that will not say, answers empty texts, never a failure.
 */
export class CustomerProfileNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = CUSTOMER_PROFILE_MANIFEST

    constructor(
        private readonly connections: ConnectionsService,
        private readonly profiles: ChannelProfileRegistryService,
    ) {}

    /** Runs the one tool of the connector. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, _caller: NativeCaller): Promise<ToolJson> {
        if (tool !== CUSTOMER_PROFILE_TOOL.get) throw unknownTool(tool)
        const asked = argumentsOf(tool, CUSTOMER_PROFILE_GET_SCHEMA, args)
        const connection = await this.connections.get(workspaceId, asked.accountId).catch((cause: unknown) => {
            if (cause instanceof ConnectionsError && cause.code === ConnectionsErrorCode.NotFound) throw nativeRefusal("not_found", cause)
            throw cause
        })
        const port = this.profiles.of(connection.provider)
        const profile = port === undefined ? null : await port.profileOf(connection.id, asked.personId)
        return { name: profile?.name ?? "", picture: profile?.picture ?? "" }
    }
}
