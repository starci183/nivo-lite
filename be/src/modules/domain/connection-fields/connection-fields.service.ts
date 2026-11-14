import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { ConnectionsService, type ConnectionActor, type ConnectionRecord } from "@modules/domain/connections"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type {
    ConnectionActionResult,
    ConnectionFieldInput,
    ConnectionDisplayNameInput,
    ConnectionActionInputs,
    ConnectionFieldsView,
    ConnectionFieldWriter,
} from "./connection-fields.contracts"
import { InjectConnectionFieldWriters } from "./connection-fields.decorators"
import { ConnectionFieldsLogEvent } from "./connection-fields.log-events"
import {
    actionInputsOf,
    actionOf,
    actionViewsOf,
    changeOf,
    disabledProvidersOf,
    fieldViewsOf,
    isEmptyChange,
    needsStoredSecret,
    needsWebhookUrl,
    rolesInclude,
    secretKeysOf,
    servedFormOf,
    throwFirstRefusal,
    type ServedForm,
} from "./connection-fields.policy"
import { ConnectionFieldsError, ConnectionFieldsErrorCode } from "./errors/connection-fields.error"

@Injectable()
/**
 * THE GENERIC CONNECTION FORM, the one surface a connection is configured on. A read shows any member of the workspace the account's
 * display name, the fields its provider declares with their PUBLIC values (a secret answers only whether one is sealed), its declared
 * actions and guidance, and what the caller may change or run. A change is checked against the declaration AND the provider's own
 * rules before anything is written (a refusal writes nothing), then handed to the provider's registered writer, which runs the
 * provider's own existing write; an action runs through the provider's own service the same way. Nothing here writes a connection or
 * reads a secret. A provider with no writer is read-only.
 */
export class ConnectionFieldsService implements OnModuleInit {
    /** The providers whose form could put a secret on a page, with their problem codes: disabled here, every other one served. */
    private disabled: ReadonlyMap<string, ReadonlyArray<string>> | null = null

    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly members: WorkspaceMembersService,
        private readonly connections: ConnectionsService,
        @Optional() @InjectConnectionFieldWriters() private readonly writers?: ReadonlyArray<ConnectionFieldWriter>,
    ) {}

    /** At boot: ONE error per provider whose form is disabled, with its problem codes (no value); the app starts all the same. */
    onModuleInit(): void {
        for (const [provider, codes] of this.disabledProviders()) {
            this.logger.error(ConnectionFieldsLogEvent.DeclarationRefused, null, { provider, codes })
        }
    }

    /** The form of one account of the workspace; a non-member, an account of no such id and a disabled provider are refused. */
    async fieldsOf(actor: ConnectionActor, connectionId: string): Promise<ConnectionFieldsView> {
        const member = await this.members.require(actor.principalId, actor.workspaceId)
        const record = await this.connections.get(actor.workspaceId, connectionId)
        this.refuseDisabled(record.provider)
        return this.viewOf(record, member.role)
    }

    /**
     * Applies a person's change to one account through its provider's writer and answers the form again. Refused, with nothing
     * written: a provider with no writer (`NOT_WRITABLE`), a role the provider's writes do not admit (`FORBIDDEN`), a change the
     * declaration or the provider's own rules do not allow.
     */
    async update(
        actor: ConnectionActor,
        connectionId: string,
        displayName: ConnectionDisplayNameInput,
        inputs: ReadonlyArray<ConnectionFieldInput>,
    ): Promise<ConnectionFieldsView> {
        const member = await this.members.require(actor.principalId, actor.workspaceId)
        const record = await this.connections.get(actor.workspaceId, connectionId)
        this.refuseDisabled(record.provider)
        const served = this.servedOf(record)
        if (!rolesInclude(served.declaration.editableBy, member.role)) {
            throw new ConnectionFieldsError({ code: ConnectionFieldsErrorCode.Forbidden })
        }
        const change = changeOf(served.declaration, record, displayName, inputs)
        if (isEmptyChange(change)) return this.viewOf(record, member.role)
        throwFirstRefusal(served.writer.check?.(record, change) ?? [])
        await served.writer.write(actor, record, change)
        this.logger.info(ConnectionFieldsLogEvent.Updated, {
            workspaceId: actor.workspaceId,
            connectionId: record.id,
            provider: record.provider,
            keys: Object.keys(change.values),
            renamed: change.displayName !== null,
        })
        return this.viewOf(await this.connections.get(actor.workspaceId, record.id), member.role)
    }

    /**
     * Runs one declared action of an account (send a test email, make it the default) through its provider's own service and answers
     * its result members and the form again. Refused before it runs: an undeclared action (`ACTION_UNKNOWN`), a role the action does
     * not admit (`FORBIDDEN`), inputs its declaration does not allow.
     */
    async runAction(
        actor: ConnectionActor,
        connectionId: string,
        key: string,
        inputs: ConnectionActionInputs,
    ): Promise<ConnectionActionResult> {
        const member = await this.members.require(actor.principalId, actor.workspaceId)
        const record = await this.connections.get(actor.workspaceId, connectionId)
        this.refuseDisabled(record.provider)
        const served = this.servedOf(record)
        const action = actionOf(served.declaration, key)
        if (!rolesInclude(action.runBy, member.role)) {
            throw new ConnectionFieldsError({ code: ConnectionFieldsErrorCode.Forbidden })
        }
        const values = actionInputsOf(action, inputs ?? [])
        if (served.writer.run === undefined) {
            throw new ConnectionFieldsError({ code: ConnectionFieldsErrorCode.ActionUnknown, params: { action: key } })
        }
        const answered = await served.writer.run(actor, record, action.key, values)
        const secrets = secretKeysOf(served.declaration, action)
        const dropped = Object.keys(answered).filter((answeredKey) => secrets.has(answeredKey))
        if (dropped.length > 0) {
            this.logger.error(ConnectionFieldsLogEvent.SecretAnswerDropped, null, {
                provider: record.provider,
                action: action.key,
                keys: dropped,
            })
        }
        const answer = Object.fromEntries(Object.entries(answered).filter(([answeredKey]) => !secrets.has(answeredKey)))
        this.logger.info(ConnectionFieldsLogEvent.ActionRun, {
            workspaceId: actor.workspaceId,
            connectionId: record.id,
            provider: record.provider,
            action: action.key,
            keys: Object.keys(values),
        })
        return {
            action: action.key,
            results: action.results.map((entry) => ({ key: entry.key, label: entry.label, value: answer[entry.key] ?? null })),
            form: await this.viewOf(await this.connections.get(actor.workspaceId, record.id), member.role),
        }
    }

    /** The providers whose form is disabled, worked out once from the registered writers. */
    private disabledProviders(): ReadonlyMap<string, ReadonlyArray<string>> {
        this.disabled ??= disabledProvidersOf(this.writers ?? [])
        return this.disabled
    }

    /** Refuses `DECLARATION_INVALID` for a provider whose form could put a secret on a page (its codes, never a value). */
    private refuseDisabled(provider: string): void {
        const codes = this.disabledProviders().get(provider)
        if (codes !== undefined) {
            throw new ConnectionFieldsError({
                code: ConnectionFieldsErrorCode.DeclarationInvalid,
                params: { provider, codes: codes.join(",") },
            })
        }
    }

    /** The writer and form of the account's provider; refused `NOT_WRITABLE` when none is registered. */
    private servedOf(record: ConnectionRecord): ServedForm {
        const served = servedFormOf(this.writers ?? [], record.provider)
        if (served === null) throw new ConnectionFieldsError({ code: ConnectionFieldsErrorCode.NotWritable })
        return served
    }

    /** The form of an account for a member of the given role. */
    private async viewOf(record: ConnectionRecord, role: string): Promise<ConnectionFieldsView> {
        const served = servedFormOf(this.writers ?? [], record.provider)
        if (served === null) {
            return {
                connectionId: record.id,
                provider: record.provider,
                displayName: record.name,
                canEdit: false,
                writable: false,
                canTest: false,
                fields: [],
                actions: [],
                guidance: null,
            }
        }
        const { declaration } = served
        const canEdit = rolesInclude(declaration.editableBy, role)
        const extras = {
            storedSecret: needsStoredSecret(declaration) ? await this.connections.hasSecret(record.id) : false,
            webhookUrl: needsWebhookUrl(declaration) ? this.connections.webhookUrl(record.provider, record.id) : null,
        }
        return {
            connectionId: record.id,
            provider: record.provider,
            displayName: record.name,
            canEdit,
            writable: true,
            canTest: declaration.canTest,
            fields: fieldViewsOf(declaration, record, extras, canEdit),
            actions: actionViewsOf(declaration, role),
            guidance: declaration.guidance ?? null,
        }
    }
}
