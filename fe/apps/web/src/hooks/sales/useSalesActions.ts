import { useSalesActionRunner } from "./useSalesActionRunner"
import { useSalesCommands } from "./useSalesCommands"
import { useSalesWorkActions } from "./useSalesWorkActions"

/** Sales writes, localized feedback and the persisted status of queued work. */
export const useSalesActions = () => {
    const runner = useSalesActionRunner()
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
        isMutating: runner.isBusy || work.isMutating || commands.isMutating,
    }
}

/** The commands passed from the Sales blocks to their forms and rows. */
export type SalesActions = ReturnType<typeof useSalesActions>
