import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ConnectionGrantsService, purposeFor } from "@modules/domain/connection-grants"
import { randomSecret } from "@modules/domain/connection-secrets"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, Provider } from "@modules/domain/connections"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import { AgentDirectoryService } from "@modules/domain/agents"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectChannelProvisioningOptions } from "./channel-provisioning.decorators"
import type { ProvisionFlags } from "./channel-provisioning.contracts"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"

/** The most agents one bind reaches. */
const AGENT_LIMIT = 500

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

const ZALO_APP_ID = /^\d{6,30}$/u
const ZALO_KEY_MIN = 8

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
        private readonly connections: ConnectionsService,
        private readonly members: WorkspaceMemberDirectoryService,
        private readonly agents: AgentDirectoryService,
    ) {}

    /** Connects the channel `kind` to the workspace of the flags; a missing flag or secret refuses the run before anything is stored. */
    async run(kind: string, flags: ProvisionFlags): Promise<void> {
        const workspaceId =
            flags.workspace !== undefined && UUID.test(flags.workspace) ? flags.workspace : invalid("workspace")
        const owner = await this.members.firstActiveOwnerUserId(workspaceId)
        if (owner === null) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: workspaceId } })
        }
        const actor: ConnectionActor = { principalId: owner, workspaceId }
        if (kind === "telegram") return this.telegram(actor, flags)
        if (kind === "sepay") return this.sepay(actor, flags)
        if (kind === "zalo") return this.zalo(actor, flags)
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

    /**
     * Zalo OA from ZALO_APP_ID, ZALO_APP_SECRET(_FILE) and ZALO_OA_SECRET(_FILE): the connection is created with every key sealed at
     * once; the OA owner still grants the OA permissions in the browser (Connections, "Authorise"), which Zalo requires interactively.
     */
    private async zalo(actor: ConnectionActor, flags: ProvisionFlags): Promise<void> {
        const appId = this.options.zaloAppId?.trim() ?? ""
        if (!ZALO_APP_ID.test(appId)) invalid("ZALO_APP_ID")
        const appSecret = this.options.zaloAppSecret?.reveal().trim() ?? ""
        if (appSecret.length < ZALO_KEY_MIN) invalid("ZALO_APP_SECRET")
        const oaSecret = this.options.zaloOaSecret?.reveal().trim() ?? ""
        if (oaSecret.length < ZALO_KEY_MIN) invalid("ZALO_OA_SECRET")
        const id = await this.connections.create({
            workspaceId: actor.workspaceId,
            createdBy: actor.principalId,
            provider: "zalo_oa",
            name: flags.name ?? "Zalo OA",
            status: "pending",
            environment: "live",
            meta: { app_id: appId, oa_secret_saved: "true" },
            secret: { plain: JSON.stringify({ appId, appSecret, oaSecret }), webhookSecret: randomSecret() },
        })
        this.options.print(
            `zalo connection ${id}; webhook ${this.connections.webhookUrl("zalo_oa", id)}; open Connections and press Authorise to grant the OA permissions`,
        )
        await this.bind(actor, id, "zalo_oa", flags)
    }

    /** With --bind, gives every agent of the workspace that can use the provider access to the connection. */
    private async bind(
        actor: ConnectionActor,
        connectionId: string,
        provider: Provider,
        flags: ProvisionFlags,
    ): Promise<void> {
        if (flags.bind !== true) return
        const agents = await this.agents.moduleRefsOf(actor.workspaceId, AGENT_LIMIT)
        const eligible = agents.filter((agent) => purposeFor(agent.module, provider) !== null)
        await this.grants.setConnectionAgents(
            actor,
            connectionId,
            eligible.map((agent) => ({ agentId: agent.id })),
        )
        this.options.print(`bound ${eligible.length} agent(s)`)
    }
}
