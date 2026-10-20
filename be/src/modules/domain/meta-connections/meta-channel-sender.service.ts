import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectChannelSenderRegistry } from "@modules/domain/channels"
import type { ChannelSender, ChannelSenderRegistry } from "@modules/domain/channels"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { ConnectionsService } from "@modules/domain/connections"
import { InjectMetaClient } from "@modules/integrations/meta"
import type { MetaClient } from "@modules/integrations/meta"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MetaConnectionsLogEvent } from "./meta-connections.log-events"
import { parseMetaSecret } from "./meta-secret.policy"

/** The customer id on the channel is the part before the colon (archived conversations carry a suffix). */
const personOf = (externalId: string): string => {
    const end = externalId.length
    let colon = -1
    for (let at = end - 1; at >= 0; at -= 1) {
        const char = externalId.charAt(at)
        if (/[\r\n\u2028\u2029]/u.test(char)) break
        if (char === ":") colon = at
    }
    return colon < 0 ? externalId : externalId.slice(0, colon)
}

@Injectable()
/** Sends the company side of a Facebook or Instagram conversation through the Page of the connection the conversation came in on. */
export class MetaChannelSender implements ChannelSender, OnModuleInit {
    /** The conversation channels this sender delivers; the registry routes a send here by them. */
    readonly channels = ["facebook", "instagram"] as const

    constructor(
        @InjectChannelSenderRegistry() private readonly registry: ChannelSenderRegistry,
        @InjectMetaClient() private readonly meta: MetaClient,
        private readonly connections: ConnectionsService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Registers this sender for its channels once at start. */
    onModuleInit(): void {
        this.registry.add(this)
    }

    /** Pushes the text to the customer; false when the Page is gone, the credential is unreadable or Meta refused. Never throws. */
    async send(conversation: ConversationTarget, text: string): Promise<boolean> {
        const platform = conversation.channel === "instagram" ? "instagram" : "facebook"
        if (conversation.connectionId === null || conversation.externalId === null) return false
        const connectionId = conversation.connectionId
        const unavailable = (cause: unknown): null => {
            this.logger.error(MetaConnectionsLogEvent.SendUnavailable, cause, { connectionId })
            return null
        }
        const connection = await this.connections.find(conversation.workspaceId, connectionId).catch(unavailable)
        const sealed = connection === null ? null : await this.connections.readSecret(connection.id).catch(unavailable)
        const secret = sealed === null ? {} : parseMetaSecret(sealed.plain)
        if (connection === null || secret.pageId === undefined || secret.pageToken === undefined) return false
        const result = await this.meta.deliverMessage(
            { pageId: secret.pageId, pageToken: secret.pageToken, igId: connection.meta.ig_id ?? null },
            platform,
            personOf(conversation.externalId),
            text,
            "standard",
        )
        return result.ok
    }
}
