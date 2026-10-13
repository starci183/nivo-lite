import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ConnectionGrantsService, purposeFor } from "@modules/domain/connection-grants"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import type { ConnectionActor, Provider } from "@modules/domain/connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectChannelProvisioningOptions } from "./channel-provisioning.decorators"
import type { ProvisionFlags } from "./channel-provisioning.contracts"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"
import type { AgentRow, OwnerRow } from "./persistence/channel-provisioning.rows"
import { FIND_WORKSPACE_OWNER, LIST_WORKSPACE_AGENTS } from "./persistence/channel-provisioning.sql"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

const invalid = (field: string): never => {
    throw new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })
}

@Injectable()
/**
 * Connects a Telegram bot or a SePay feed to a workspace from the terminal, as the owner of that workspace and through the
 * same capability the console uses. Secrets come from the environment; the only secret printed is the SePay API key NIVO generates,
 * which must be pasted into SePay.
 */
export class ChannelProvisioningService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectChannelProvisioningOptions() private readonly options: ChannelProvisioningOptions,
        private readonly channels: ChannelConnectionsService,
        private readonly grants: ConnectionGrantsService,
    ) {}

    /** Connects the channel `kind` to the workspace of the flags; a missing flag or secret refuses the run before anything is stored. */
    async run(kind: string, flags: ProvisionFlags): Promise<void> {
        const workspaceId =
            flags.workspace !== undefined && UUID.test(flags.workspace) ? flags.workspace : invalid("workspace")
        const rows: ReadonlyArray<OwnerRow> = await this.entityManager.query(FIND_WORKSPACE_OWNER, [workspaceId])
        const owner = rows[0]
        if (owner === undefined) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: workspaceId } })
        }
        const actor: ConnectionActor = { principalId: owner.user_id, workspaceId }
        if (kind === "telegram") return this.telegram(actor, flags)
        if (kind === "sepay") return this.sepay(actor, flags)
        return invalid("kind")
    }

    private async telegram(actor: ConnectionActor, flags: ProvisionFlags): Promise<void> {
        const token = this.options.telegramToken?.reveal() ?? invalid("CHANNEL_BOT_TOKEN")
        const { connection, webhookRegistered } = await this.channels.connectTelegram(actor, {
            name: flags.name ?? "Bot Telegram",
            token,
        })
        const webhook = webhookRegistered ? "registered" : "not registered (the site is not public https)"
        this.options.print(`telegram connection ${connection.id} (${connection.name}); webhook ${webhook}`)
        await this.bind(actor, connection.id, "telegram", flags)
    }

    private async sepay(actor: ConnectionActor, flags: ProvisionFlags): Promise<void> {
        const view = await this.channels.startMoneyConnection(actor, {
            provider: "sepay",
            environment: flags.environment ?? "test",
            name: flags.name ?? "SePay",
            bankCode: flags.bankCode ?? invalid("bank-code"),
            accountNumber: flags.account ?? invalid("account"),
            holder: flags.holder ?? invalid("holder"),
        })
        this.options.print(
            `sepay connection ${view.id}; paste into SePay: url ${view.webhookUrl}  api key ${view.apiKey}`,
        )
        await this.bind(actor, view.id, "sepay", flags)
    }

    /** With --bind, gives every agent of the workspace that can use the provider access to the connection. */
    private async bind(
        actor: ConnectionActor,
        connectionId: string,
        provider: Provider,
        flags: ProvisionFlags,
    ): Promise<void> {
        if (flags.bind !== true) return
        const agents: ReadonlyArray<AgentRow> = await this.entityManager.query(LIST_WORKSPACE_AGENTS, [
            actor.workspaceId,
        ])
        const eligible = agents.filter((agent) => purposeFor(agent.module, provider) !== null)
        await this.grants.setConnectionAgents(
            actor,
            connectionId,
            eligible.map((agent) => ({ agentId: agent.id })),
        )
        this.options.print(`bound ${eligible.length} agent(s)`)
    }
}
