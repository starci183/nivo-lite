import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentWakeService } from "@modules/domain/agent-work"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { WakeRow } from "./agent-turns.contracts"
import { splitWakeOf } from "./intent-wake.policy"

@Injectable()
/**
 * The follow-up of a turn whose picked intent runs alone. The wake it writes carries the context of the wake it answers, pinned to the
 * intent, under the key `intent:<wakeId>:<intent>`: the same split twice is one wake, and it runs in the same scope, so the
 * conversation keeps its order.
 */
export class IntentSplitService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly wakes: AgentWakeService,
    ) {}

    /** Writes the follow-up wake and its drain job in one transaction; answers false when the follow-up was already written. */
    fire(wake: WakeRow, intent: string): Promise<boolean> {
        return this.entityManager.transaction((tx) => this.wakes.wake(tx, splitWakeOf(wake, intent)))
    }
}
