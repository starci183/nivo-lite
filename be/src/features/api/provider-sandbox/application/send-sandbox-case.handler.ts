import { CommandHandler } from "@nestjs/cqrs"
import type { ConnectionActor } from "@modules/domain/connections"
import {
    ProviderSandboxAccountsService,
    ProviderSandboxError,
    ProviderSandboxErrorCode,
    type SandboxInput,
    type SandboxInputField,
    type SandboxSendResult,
} from "@modules/domain/provider-sandbox"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SendSandboxCaseCommand } from "./provider-sandbox.commands"
import type { SandboxGivenInput } from "./provider-sandbox.contracts"

/** A whole number written in decimal digits, with an optional sign. */
const INTEGER = /^[+-]?\d+$/u

/** One given value read as the kind its field declares; an integer that is no safe integer is refused naming the field. */
const valueOf = (field: SandboxInputField, value: string): string | number => {
    if (field.kind === "text") return value
    const whole = INTEGER.test(value.trim()) ? Number(value.trim()) : Number.NaN
    if (!Number.isSafeInteger(whole)) {
        throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.InputInvalid, params: { field: field.name } })
    }
    return whole
}

/** The given inputs converted to the kinds of the case's declared fields; a name the case does not declare is left out. */
export const sandboxInputOf = (fields: ReadonlyArray<SandboxInputField>, given: ReadonlyArray<SandboxGivenInput>): SandboxInput =>
    Object.fromEntries(
        given.flatMap((one) => {
            const field = fields.find((declared) => declared.name === one.name)
            return field === undefined ? [] : [[field.name, valueOf(field, one.value)] as const]
        }),
    )

@CommandHandler(SendSandboxCaseCommand)
/**
 * Sends one inbound case through the sandbox doors. The page types every value as text, so the handler reads the account's provider
 * (`accounts`), the provider's case (`catalogue`) and converts each given value to its declared field's kind before the one send.
 */
export class SendSandboxCaseHandler extends ICQRSHandler<SendSandboxCaseCommand, SandboxSendResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: ProviderSandboxAccountsService,
    ) {
        super(logger)
    }

    protected override async process(command: SendSandboxCaseCommand): Promise<SandboxSendResult> {
        const { connectionId, caseId, inputs } = command.params.request
        const actor: ConnectionActor = { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId }
        // The doors' one account read: unknown or removed `PROVIDER_SANDBOX_ACCOUNT_NOT_FOUND`, a LIVE account `PROVIDER_SANDBOX_LIVE_ACCOUNT`.
        const account = await this.accounts.account(actor, connectionId)
        const inbound = (await this.accounts.catalogue(actor, account.provider)).find((one) => one.id === caseId)?.inbound
        if (inbound === undefined) throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.CaseUnknown, params: { caseId } })
        return this.accounts.send(actor, connectionId, caseId, sandboxInputOf(inbound.inputs, inputs))
    }
}
