import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { BankCreditBookedEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { SettleBankCreditCommand } from "../../application/settle-bank-credit.command"

@Injectable()
/** The consumer door of the bank_credit_booked event in the bank-credit-settlement reactor: it dispatches one command and forwards the event id. */
export class BankCreditBookedConsumer implements EventConsumer<BankCreditBookedEvent> {
    readonly event = BankCreditBookedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims the delivery in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<BankCreditBookedEvent>): Promise<void> {
        await this.commandBus.execute(
            new SettleBankCreditCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
