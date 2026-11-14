import type { Provider } from "@nestjs/common"
import { AgentGraphSubjectHoldsService } from "@modules/domain/agent-graphs"
import type { MoneyDb } from "./thread-world-money"

// The HOLD of the money world (FX3, D-P11-4): the REAL subject hold (rule Q-1: a run that is not finished keeps its subject for every
// workflow; the open stops about a person) the flow asks before any run opens, composed into the money process. The thread half of the
// hold (the release of the wakes held behind a finished run) is the thread module's own.

/** The providers that give the money process the hold: the graph half of the subject hold, over the world's runs and stops. */
export const holdProvidersOf = (_db: MoneyDb): ReadonlyArray<Provider> => {
    return [
        AgentGraphSubjectHoldsService,
    ]
}

/** The wakes the world holds behind a run (`waiting:<run>`), oldest first. */
export const heldWakesOf = (db: MoneyDb): ReadonlyArray<{ readonly id: string; readonly reason: string }> =>
    db.chat.wakes.flatMap((wake) => (wake.state === "held" && wake.reason?.startsWith("waiting:") === true ? [{ id: wake.id, reason: wake.reason }] : []))
