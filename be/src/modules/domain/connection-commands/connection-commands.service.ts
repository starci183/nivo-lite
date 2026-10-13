import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ConnectionLifecycleService } from "@modules/domain/connection-lifecycle"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor } from "@modules/domain/connections"
import { GoogleConnectionsService } from "@modules/domain/google-connections"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { WebhookConnectionsService } from "@modules/domain/webhook-connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectErrorsService } from "@modules/platform/errors"
import type { ErrorsService } from "@modules/platform/errors"
import { isConnectionCommandPayload } from "@modules/queues/connection-commands"
import type { CommandFailed, CommandOutcome } from "./connection-commands.contracts"
import { toConnectionCommand } from "./connection-commands.mapper"
import { runCommand } from "./connection-commands.policy"
import type { ConnectionCommandRow } from "./persistence/connection-commands.rows"
import { FIND_COMMAND, FINISH_COMMAND } from "./persistence/connection-commands.sql"

@Injectable()
/** Runs the console commands members submitted through the database: as that member, in that workspace, writing the outcome back to the row. */
export class ConnectionCommandsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectErrorsService() private readonly errors: ErrorsService,
        private readonly connections: ConnectionsService,
        private readonly grants: ConnectionGrantsService,
        private readonly channels: ChannelConnectionsService,
        private readonly webhooks: WebhookConnectionsService,
        private readonly google: GoogleConnectionsService,
        private readonly meta: MetaConnectionsService,
        private readonly lifecycle: ConnectionLifecycleService,
    ) {}

    /** Runs the command a claimed job names; a payload that is not a connection-commands payload is left alone. */
    async runPayload(payload: object): Promise<void> {
        if (isConnectionCommandPayload(payload)) await this.run(payload.commandId)
    }

    /**
     * Runs one pending command and writes its outcome (the answer, or the code of the failure) to the row; an unknown or finished command
     * changes nothing, so a redelivered job never runs a command twice.
     */
    async run(commandId: string): Promise<void> {
        const rows: ReadonlyArray<ConnectionCommandRow> = await this.entityManager.query(FIND_COMMAND, [commandId])
        const row = rows[0]
        if (row === undefined) return
        const command = toConnectionCommand(row)
        if (command.status === "done") return
        const outcome = await this.outcomeOf(command.kind, command.input, {
            principalId: command.userId,
            workspaceId: command.workspaceId,
        })
        await this.entityManager.query(FINISH_COMMAND, [command.id, JSON.stringify(outcome)])
    }

    private async outcomeOf(
        kind: string,
        input: Readonly<Record<string, unknown>>,
        actor: ConnectionActor,
    ): Promise<CommandOutcome> {
        try {
            const value = await runCommand(
                {
                    connections: this.connections,
                    grants: this.grants,
                    channels: this.channels,
                    webhooks: this.webhooks,
                    google: this.google,
                    meta: this.meta,
                    lifecycle: this.lifecycle,
                },
                actor,
                kind,
                input,
            )
            return { ok: true, value }
        } catch (cause) {
            return this.failed(cause)
        }
    }

    /** The failure written back for the browser: the code, kind and display parameters the errors capability gives the cause. */
    private failed(cause: unknown): CommandFailed {
        const description = this.errors.describe(cause)
        return { ok: false, kind: description.kind, code: description.code, params: description.params }
    }
}
