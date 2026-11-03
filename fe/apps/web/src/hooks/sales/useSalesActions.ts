import { useSalesActionRunner } from "./useSalesActionRunner"
import type { SalesActionActivity } from "./useSalesActionRunner"
import { useSalesCommands } from "./useSalesCommands"
import { useSalesWorkActions } from "./useSalesWorkActions"
import type {
    DecideSalesDraftRequest,
    DecideSalesWorkItemRequest,
    HandoffToAccountingRequest,
    RetryFailedStepRequest,
    StopFailedStepRequest,
    SaveContractRequest,
    MarkOrderShippedRequest,
} from "../swr"

type UseSalesActionsResult = {
    decideDraft: (input: DecideSalesDraftRequest) => Promise<
        | {
              errorCode: string | null
              id: string
              status: string
              workItemId: string | null
          }
        | undefined
    >
    decideWorkItem: (input: DecideSalesWorkItemRequest) => Promise<
        | {
              errorCode: string | null
              id: string
              status: string
              workItemId: string | null
          }
        | undefined
    >
    handoffToAccounting: (input: HandoffToAccountingRequest) => Promise<
        | {
              errorCode: string | null
              id: string
              status: string
              workItemId: string | null
          }
        | undefined
    >
    retryFailedStep: (input: RetryFailedStepRequest) => Promise<
        | {
              errorCode: string | null
              id: string
              status: string
              workItemId: string | null
          }
        | undefined
    >
    stopFailedStep: (input: StopFailedStepRequest) => Promise<
        | {
              id: string
              status: string
          }
        | undefined
    >
    saveContract: (input: SaveContractRequest) => Promise<
        | {
              amountVnd: number | null
              customerName: string
              endsOn: string
              id: string
              leadId: string | null
              note: string
              plan: string
              startsOn: string
              status: string
          }
        | undefined
    >
    markOrderShipped: (input: MarkOrderShippedRequest) => Promise<
        | {
              id: string
              notificationId: string
              orderNo: string
          }
        | undefined
    >
    isMutating: boolean
}

/** Sales writes, localized feedback and the persisted status of queued work. */
export const useSalesActions = (activity?: SalesActionActivity): UseSalesActionsResult => {
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
