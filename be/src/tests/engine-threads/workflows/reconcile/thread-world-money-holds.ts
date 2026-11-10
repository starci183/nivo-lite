import type { Provider } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import type { Mutation } from "@nivo-lite/agent-sdk/mutation"
import { AgentGraphFreezeGateService } from "@modules/domain/agent-graphs"
import { EntityMutationService, type ScopedTx } from "@modules/domain/entity-engine"
import { LeadFreezeRecordsService, LeadFreezeWakesService, LeadFreezesService } from "@modules/domain/lead-freezes"
import { LeadFreezeStopHoldsService } from "@modules/domain/lead-freezes/lead-freeze-stop-holds.service"
import { LeadFreezeStopsService } from "@modules/domain/lead-freezes/lead-freeze-stops.service"
import { CONV, LEAD } from "../../thread-world"
import type { MoneyDb } from "./thread-world-money"

// The HOLD of the money world (FX3, D-P11-4): the REAL lead-freezes services (the hold of a customer while a stop of a thread run about
// them stands open, its pending events, the release and the replay) composed into the money process with the freeze gate the flow asks
// before any run opens. No other world composed them, so no spec ever drove a customer's line into an open stop.

const FREEZE = "agent.lead-freeze"

/**
 * The mutations of the world with the one unique key the freeze entity declares (`freeze_key` on `key`): an `ensure` of a key already
 * written answers that freeze, as the engine does. Every other write goes to the world's records unchanged.
 */
const mutationsWithFreezeKeys = (db: MoneyDb): EntityMutationService =>
    mock<EntityMutationService>({
        mutate: (tx: ScopedTx, mutation: Mutation) => {
            if (mutation.op === "ensure" && mutation.entity === FREEZE) {
                const found = db.records.of(FREEZE, { key: mutation.values.key }).at(0)
                if (found !== undefined)
                    return Promise.resolve({ ok: true, row: found, version: found.version, created: false })
            }
            return db.records.mutations.mutate(tx, mutation, "job")
        },
    })

/**
 * The providers that give the money process the hold: the freeze gate, the lead-freezes services as their module composes them, and the
 * freeze key. The customer's conversation is put among the records the freezes read (`chat.conversation` → its lead), as the app has it.
 */
export const holdProvidersOf = (db: MoneyDb): ReadonlyArray<Provider> => {
    db.records.put("chat.conversation", CONV, { leadId: LEAD, channel: "zalo" })
    return [
        AgentGraphFreezeGateService,
        LeadFreezeRecordsService,
        LeadFreezeStopsService,
        LeadFreezeStopHoldsService,
        LeadFreezeWakesService,
        LeadFreezesService,
        { provide: EntityMutationService, useValue: mutationsWithFreezeKeys(db) },
    ]
}

/** The freezes the world holds, as rows. */
export const freezesOf = (db: MoneyDb): ReadonlyArray<Readonly<Record<string, unknown>>> =>
    db.records.of(FREEZE).map((row) => row.data)
