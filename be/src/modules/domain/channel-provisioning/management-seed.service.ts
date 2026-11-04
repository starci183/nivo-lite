import { Injectable } from "@nestjs/common"
import { ChannelSeedService } from "@modules/domain/channel-connections"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor } from "@modules/domain/connections"
import { SmtpWizardService } from "@modules/domain/email-messages"
import { OwnersService } from "@modules/domain/owners"
import { WorkspacesService } from "@modules/domain/workspaces"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectChannelProvisioningOptions } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"
import type { ManagementSeed, ManagementSmtp } from "./management-seed.contracts"
import { readManagementSeed, readSeedDocuments } from "./management-seed.policy"

/** The sender name of the management workspace mail. */
const SENDER_NAME = "NIVO"
/** The port of implicit TLS; every other mail port starts TLS on the open channel. */
const TLS_PORT = 465

@Injectable()
/**
 * The seed of the NIVO management workspace: its owner account, the workspace, its mail server and its Telegram, Zalo OA, SePay and
 * payOS connections under fixed ids. It runs as the data seed command of the stack, so the documents arrive on stdin, already
 * opened from their sealed member; it prints what it did and never a value.
 */
export class ManagementSeedService {
    constructor(
        @InjectChannelProvisioningOptions() private readonly options: ChannelProvisioningOptions,
        private readonly owners: OwnersService,
        private readonly workspaces: WorkspacesService,
        private readonly channels: ChannelSeedService,
        private readonly connections: ConnectionsService,
        private readonly smtp: SmtpWizardService,
    ) {}

    /** Applies every document of the stack seed envelope read from `text`; a document that is refused stops the run. */
    async run(text: string): Promise<void> {
        await eachInOrder(readSeedDocuments(text), (document) => this.apply(readManagementSeed(document)))
    }

    private async apply(seed: ManagementSeed): Promise<void> {
        const ownerId = await this.owners.ensureAccount(seed.ownerEmail)
        const { id } = await this.workspaces.ensureNamed(ownerId, seed.workspaceName)
        const actor: ConnectionActor = { principalId: ownerId, workspaceId: id }
        this.options.print(`management workspace ${id}`)
        for (const seeded of await this.channels.ensure(actor, seed.channels)) {
            this.options.print(
                `${seeded.provider} connection ${seeded.id} ${seeded.action}, credentials ${seeded.credentials}`,
            )
        }
        if (seed.smtp !== undefined) await this.mail(actor, seed.smtp)
    }

    /** Stores the mail server of the workspace as a pending SMTP connection, unless the workspace already has one for that sender. */
    private async mail(actor: ConnectionActor, smtp: ManagementSmtp): Promise<void> {
        const held = await this.connections.listByProvider(actor.workspaceId, "smtp", { includeDisconnected: false })
        if (held.some((connection) => connection.meta.host === smtp.host && connection.meta.from_email === smtp.from)) {
            this.options.print("smtp connection kept")
            return
        }
        const view = await this.smtp.start(actor, {
            preset: "relay_service",
            host: smtp.host,
            port: smtp.port,
            security: smtp.port === TLS_PORT ? "tls" : "starttls",
            user: smtp.user,
            password: smtp.password,
            fromName: SENDER_NAME,
            fromEmail: smtp.from,
            replyTo: "",
        })
        this.options.print(`smtp connection ${view.id} created, pending its test email`)
    }
}
