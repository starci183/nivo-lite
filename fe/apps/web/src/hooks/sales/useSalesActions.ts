import { useSalesActionRunner } from "./useSalesActionRunner"
import type { SalesActionActivity } from "./useSalesActionRunner"
import { useSalesCommands } from "./useSalesCommands"
import { useSalesWorkActions } from "./useSalesWorkActions"

/** Sales writes, localized feedback and the persisted status of queued work. */
export const useSalesActions = (activity?: SalesActionActivity) => {
    const runner = useSalesActionRunner(activity)
    const work = useSalesWorkActions(runner)
    const commands = useSalesCommands(runner)
    return {
        decideDraft: work.decideDraft,
        decideWorkItem: work.decideWorkItem,
        handoffToAccounting: work.handoffToAccounting,
        retryFailedStep: work.retryFailedStep,
        stopFailedStep: commands.stopFailedStep,
        saveContract: commands.saveContract,
        markOrderShipped: commands.markOrderShipped,
        isMutating:
            runner.isBusy || (activity === undefined ? work.isMutating || commands.isMutating : runner.isExecuting),
    }
}

/** The commands passed from the Sales blocks to their forms and rows. */
export type SalesActions = ReturnType<typeof useSalesActions>
