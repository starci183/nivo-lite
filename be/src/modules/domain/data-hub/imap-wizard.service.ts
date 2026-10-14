import { Injectable } from "@nestjs/common"
import type { ConnectionActor } from "@modules/domain/connections"
import { InjectImap } from "@modules/integrations/data-sources"
import type { ImapClient } from "@modules/integrations/data-sources"
import { DataHubService } from "./data-hub.service"
import type { ImapInput, ImapView } from "./imap-connection.contracts"
import {
    credentialFromInput,
    metaFromSettings,
    parseConfig,
    parseCredential,
    settingsFromInput,
} from "./imap-connection.policy"

@Injectable()
/** The wizard operations of the owner mailboxes. */
export class ImapWizardService {
    constructor(
        private readonly hub: DataHubService,
        @InjectImap() private readonly imap: ImapClient,
    ) {}

    /** Logs in read only and lists the folders; saves nothing. */
    async test(actor: ConnectionActor, input: ImapInput): Promise<Array<string>> {
        await this.hub.owner(actor)
        if (input.connectionId !== undefined && input.connectionId !== null) {
            await this.hub.own(actor.workspaceId, input.connectionId, "imap")
        }
        const credential = credentialFromInput(input, await this.savedPassword(input.connectionId ?? undefined))
        return this.imap.listFolders(credential)
    }

    /** Creates the mailbox connection, or updates the one in `connectionId`; answers its id. */
    async save(actor: ConnectionActor, input: ImapInput): Promise<string> {
        await this.hub.owner(actor)
        const settings = settingsFromInput(input)
        const existing =
            input.connectionId === undefined || input.connectionId === null
                ? null
                : await this.hub.own(actor.workspaceId, input.connectionId, "imap")
        const credential = JSON.stringify(
            credentialFromInput(input, await this.savedPassword(existing === null ? undefined : existing.id)),
        )
        const meta = metaFromSettings(settings)
        if (existing !== null) {
            await this.hub.saveCredential(existing.id, credential)
            await this.hub.update(actor.workspaceId, existing.id, {
                name: settings.name,
                meta: { ...existing.meta, ...meta },
                everyMinutes: settings.every,
            })
            return existing.id
        }
        return this.hub.create(actor, {
            provider: "imap",
            name: settings.name,
            meta,
            credential,
            everyMinutes: settings.every,
        })
    }

    /** The saved mailbox, minus the password (for editing). */
    async load(actor: ConnectionActor, connectionId: string): Promise<ImapView> {
        await this.hub.owner(actor)
        const connection = await this.hub.own(actor.workspaceId, connectionId, "imap")
        const raw = await this.hub.credentialOf(connectionId)
        const credential = raw === null ? null : parseCredential(raw)
        const config = parseConfig(connection.meta)
        return {
            id: connection.id,
            name: connection.name,
            email: connection.meta.email ?? "",
            host: credential?.host ?? "",
            port: credential?.port ?? 993,
            security: credential !== null && !credential.secure ? "starttls" : "tls",
            user: credential?.user ?? "",
            folders: config.folders,
            sinceDays: config.sinceDays,
            syncEveryMinutes: connection.everyMinutes,
            agentIds: [...new Set(await this.hub.agentIds(actor.workspaceId, connectionId))],
        }
    }

    private async savedPassword(connectionId: string | undefined): Promise<string | null> {
        if (connectionId === undefined) return null
        const raw = await this.hub.credentialOf(connectionId)
        return raw === null ? null : parseCredential(raw).password
    }
}
