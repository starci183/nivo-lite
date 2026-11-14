import { Injectable, Optional } from "@nestjs/common"
import { ConnectionBindingsReadService, ConnectionSecretReadsService } from "@modules/domain/connections"
import { ContactsService, ConversationContactsService } from "@modules/domain/contacts"
import {
    AgentAccountsService,
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
} from "@modules/domain/tools"
import {
    InjectOpenApi,
    InjectPublicHost,
    type OpenApiClient,
    type PublicHostClient,
} from "@modules/integrations/data-sources"
import { OPENAPI_SOURCE_KEYS } from "@modules/domain/openapi-tools"
import { InjectClock, type Clock } from "@modules/platform/clock"
import {
    OpenApiConnectorService,
    installedSourcesOf,
    type OpenApiCustomerLinks,
    type OpenApiViewerRead,
} from "./openapi-native.service"

/**
 * The source this adapter serves: the first one the installed plugins declare (`PluginDeclaration.sources`; NIVO Web's CRM: `crm`).
 * One adapter serves one source; a second declared source needs a second adapter (not built: one is declared at most today). With
 * no source declared, the adapter lists no tool.
 */
const [SOURCE = ""] = OPENAPI_SOURCE_KEYS

/**
 * The customer links as the connector reads them: the conversation's contact (the contact of its channel identity), then that
 * contact's `external` identity on the account that serves the call (a link a person decided, verified `member`). Unbound in an app
 * that holds no contacts: a run that serves a customer then reads no customer-specific data (fail closed).
 */
export const conversationLinksOf = (
    conversations: Pick<ConversationContactsService, "contactOf"> | undefined,
    contacts: Pick<ContactsService, "externalOf"> | undefined,
): OpenApiCustomerLinks | undefined => {
    if (conversations === undefined || contacts === undefined) return undefined
    return {
        customerOf: async (workspaceId, conversationId, connectionId) => {
            const contactId = await conversations.contactOf(workspaceId, conversationId)
            return contactId === null ? null : contacts.externalOf(workspaceId, contactId, connectionId)
        },
    }
}

@Injectable()
/**
 * The OpenAPI connection's native connector: the tools `nivo.tool.<source>.…` the installed plugins declare under the source they
 * declare for the connection, run against the workspace's API connection that pinned the system's OpenAPI document (see
 * `OpenApiConnectorService`). Nothing here names an outside system. In an app that opens no connection key or makes no outbound call
 * (the MCP endpoint app) the tools are listed and every call is refused `not_served`. A run that serves a customer reads a customer's
 * data only through the outside identity a person linked to the conversation's contact on the account (`conversationLinksOf`).
 */
export class OpenApiNativeService implements NativeToolFamily {
    /** The manifest of the connector: one tool per declaration of the installed plugins under the source. */
    readonly manifest: ToolManifest
    private readonly connector: OpenApiConnectorService

    constructor(
        bindings: ConnectionBindingsReadService,
        @InjectClock() clock: Clock,
        @Optional() secrets?: ConnectionSecretReadsService,
        @Optional() @InjectOpenApi() client?: OpenApiClient,
        @Optional() @InjectPublicHost() host?: PublicHostClient,
        @Optional() abilities?: AgentAccountsService,
        @Optional() conversations?: ConversationContactsService,
        @Optional() contacts?: ContactsService,
    ) {
        this.connector = new OpenApiConnectorService(SOURCE, installedSourcesOf(SOURCE), {
            bindings,
            clock,
            secrets,
            client,
            host,
            abilities,
            customerLinks: conversationLinksOf(conversations, contacts),
        })
        this.manifest = this.connector.manifest
    }

    /** The reads a person may run on a screen in the workspace (see `OpenApiConnectorService.viewerReads`). */
    viewerReads(workspaceId: string): Promise<ReadonlyArray<OpenApiViewerRead>> {
        return this.connector.viewerReads(workspaceId)
    }

    /** Runs one read for a person looking at a screen (see `OpenApiConnectorService.viewerRead`). */
    viewerRead(workspaceId: string, name: string, args: ToolJson): Promise<ToolJson> {
        return this.connector.viewerRead(workspaceId, name, args)
    }

    /** Runs one tool of the source for the caller. */
    invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        return this.connector.invoke(workspaceId, tool, args, caller)
    }
}
