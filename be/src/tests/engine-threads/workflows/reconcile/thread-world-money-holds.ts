import type { Provider } from "@nestjs/common"
import { AgentGraphFreezeGateService } from "@modules/domain/agent-graphs"
import { CONTACT_FREEZE_STORE, LeadFreezeRecordsService, LeadFreezeWakesService, LeadFreezesService } from "@modules/domain/lead-freezes"
import { LeadFreezeStopHoldsService } from "@modules/domain/lead-freezes/lead-freeze-stop-holds.service"
import { LeadFreezeStopsService } from "@modules/domain/lead-freezes/lead-freeze-stops.service"
import { CONTACT_FREEZES, worldFreezeStore } from "../../thread-world-tables"
import type { MoneyDb } from "./thread-world-money"

// The HOLD of the money world (FX3, D-P11-4): the REAL lead-freezes services (the hold of a customer while a stop of a thread run about
// them stands open, its pending events, the release and the replay) composed into the money process with the freeze gate the flow asks
// before any run opens. No other world composed them, so no spec ever drove a customer's line into an open stop.

/**
 * The providers that give the money process the hold: the freeze gate, the lead-freezes services as their module composes them, over the
 * world's freezes table (one freeze per subject key, as the table keeps it).
 */
export const holdProvidersOf = (db: MoneyDb): ReadonlyArray<Provider> => {
    return [
        AgentGraphFreezeGateService,
        { provide: CONTACT_FREEZE_STORE, useValue: worldFreezeStore(db.records) },
        LeadFreezeRecordsService,
        LeadFreezeStopsService,
        LeadFreezeStopHoldsService,
        LeadFreezeWakesService,
        LeadFreezesService,
    ]
}

/** The freezes the world holds, as rows. */
export const freezesOf = (db: MoneyDb): ReadonlyArray<Readonly<Record<string, unknown>>> =>
    db.records.of(CONTACT_FREEZES).map((row) => row.data)
