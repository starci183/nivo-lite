import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InboundEventsError, InboundEventsErrorCode } from "./errors/inbound-events.error"
import { eventDedupeKey } from "./inbound-dedupe.policy"
import type { BankPaymentRecorded, SimulatedInboundInput } from "./inbound-events.contracts"
import type { EventIdRow } from "./persistence/inbound-events.rows"
import { INSERT_INPUT_EVENT } from "./persistence/inbound-events.sql"
import { BUMP_SIMULATION_DUPLICATE } from "./persistence/inbound-simulation.sql"

@Injectable()
/** The inbound-events owner's simulator persistence; the caller's transaction encloses both the input and its queued job. */
export class InboundSimulationStoreService {
    constructor(@InjectClock() private readonly clock: Clock) {}

    /** Records the amount and event identity; repeated simulated deliveries count on the original row and preserve its fields. */
    async record(manager: EntityManager, input: SimulatedInboundInput): Promise<BankPaymentRecorded> {
        const key = `simulated:${eventDedupeKey(input.channel, input.kind, input.eventId)}`
        const [created] = await manager.query<Array<EventIdRow>>(INSERT_INPUT_EVENT, [
            input.workspaceId,
            input.channel,
            input.kind,
            "simulated",
            input.senderName,
            input.senderContact,
            input.body,
            input.amountVnd,
            input.externalRef,
            input.eventId.trim(),
            key,
        ])
        if (created !== undefined) return { duplicate: false, inboundEventId: created.id }
        const [repeated] = await manager.query<Array<EventIdRow>>(BUMP_SIMULATION_DUPLICATE, [
            input.workspaceId,
            key,
            this.clock.now(),
        ])
        if (repeated === undefined) throw new InboundEventsError({ code: InboundEventsErrorCode.Unreadable })
        return { duplicate: true, inboundEventId: repeated.id }
    }
}
