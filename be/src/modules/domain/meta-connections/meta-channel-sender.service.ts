import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectChannelSenderRegistry } from "@modules/domain/channels"
import type { ChannelSender, ChannelSenderRegistry } from "@modules/domain/channels"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { ConnectionsService } from "@modules/domain/connections"
import { InjectMetaClient } from "@modules/integrations/meta"
import type { MetaClient } from "@modules/integrations/meta"
import { parseMetaSecret } from "./meta-secret.policy"

/** The customer id on the channel is the part before the colon (archived conversations carry a suffix). */
const personOf = (externalId: string): string => externalId.replace(/:.*$/u, "")

@Injectable()
/** Sends the company side of a Facebook or Instagram conversation through the Page of the connection the conversation came in on. */
export class MetaChannelSender implements ChannelSender, OnModuleInit {
    readonly channels = ["facebook", "instagram"] as const

    constructor(
        @InjectChannelSenderRegistry() private readonly registry: ChannelSenderRegistry,
        @InjectMetaClient() private readonly meta: MetaClient,
        private readonly connections: ConnectionsService,
    ) {}

    /** Registers this sender for its channels once at start. */
    onModuleInit(): void {
        this.registry.add(this)
    }

    /** Pushes the text to the customer; false when the Page is gone, the credential is unreadable or Meta refused. Never throws. */
    async send(conversation: ConversationTarget, text: string): Promise<boolean> {
        const platform = conversation.channel === "instagram" ? "instagram" : "facebook"
        if (conversation.connectionId === null || conversation.externalId === null) return false
        const connection = await this.connections.find(conversation.workspaceId, conversation.connectionId).catch(() => null)
        const sealed = connection === null ? null : await this.connections.readSecret(connection.id).catch(() => null)
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
