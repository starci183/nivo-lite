import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { AccountDataInput, AccountOwner, AccountWrite } from "@modules/domain/account-data"
import { bankTransactionTriggerFor } from "@modules/domain/bank-feed-inbox"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import {
    ProviderTriggersLogEvent,
    ProviderTriggersService,
    TRANSACTION_RECEIVED,
    type DeliveredEvent,
} from "@modules/domain/provider-triggers"
import { InjectLogger, type Logger } from "@modules/platform/logging"

@Injectable()
/**
 * THE BANK FEED'S ENTRY to the one event pipeline (concept triggers rule 13): each movement a delivery kept as a NEW `<provider>.transaction`
 * row of the account (the INBOX: the provider's transaction id is the row's key, so a webhook and the reconcile poll of one movement are one
 * row) is translated by its feed's pure trigger declaration and handed to the ONE delivery function, which applies the account's switch.
 * An account in the provider's test environment hands on nothing. It runs inside a savepoint of the delivery's transaction and never
 * throws: a failure here leaves the kept rows of the delivery as they are.
 */
export class BankFeedTriggerService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly connections: ConnectionBindingsReadService,
        @Optional() private readonly triggers?: ProviderTriggersService,
    ) {}

    /** Hands on the new movements of one delivery; `rows` are the transaction rows written, `written` what the intake answered for them, in order. */
    async emit(
        tx: EntityManager,
        owner: AccountOwner,
        rows: ReadonlyArray<AccountDataInput>,
        written: AccountWrite,
    ): Promise<void> {
        const { triggers } = this
        const declaration = bankTransactionTriggerFor(owner.provider)
        if (triggers === undefined || declaration === null) return
        try {
            const state = await this.connections.stateOf(owner.connectionId, tx)
            if (state?.environment === "test") return
            const events = rows.flatMap((row, index): ReadonlyArray<DeliveredEvent> => {
                const kept = written.rows[index]
                const value = declaration.raw.safeParse(row.value)
                if (kept?.isNew !== true || !value.success) return []
                const event = declaration.translate(value.data, { connectionId: owner.connectionId })
                if (event === null) return []
                return [
                    {
                        event,
                        raw: { type: kept.type, id: kept.id },
                        ...(event.data.at === undefined ? {} : { occurredAt: event.data.at }),
                    },
                ]
            })
            if (events.length === 0) return
            await tx.transaction((inner) =>
                triggers.deliver(
                    { workspaceId: owner.workspaceId, declaration, connectionId: owner.connectionId, agentId: null, events },
                    inner,
                ),
            )
        } catch (cause) {
            this.logger.error(ProviderTriggersLogEvent.EmitFailed, cause, {
                workspaceId: owner.workspaceId,
                connectionId: owner.connectionId,
                trigger: TRANSACTION_RECEIVED,
            })
        }
    }
}
