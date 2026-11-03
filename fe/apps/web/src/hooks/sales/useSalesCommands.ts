"use client"

import { useMutateMarkOrderShippedSwr, useMutateSaveContractSwr, useMutateStopFailedStepSwr } from "@/hooks/swr"
import type { MarkOrderShippedRequest, SaveContractRequest, StopFailedStepRequest } from "@/hooks/swr"
import { useTranslations } from "next-intl"
import type { SalesActionRunner } from "./useSalesActionRunner"

type UseSalesCommandsResult = {
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

/** The Sales writes the back end answers at once: stopping a failed step, saving a contract and marking an order shipped. */
export const useSalesCommands = (runner: SalesActionRunner): UseSalesCommandsResult => {
    const t = useTranslations("workbenchSales")
    const stop = useMutateStopFailedStepSwr()
    const contract = useMutateSaveContractSwr()
    const shipment = useMutateMarkOrderShippedSwr()
    return {
        stopFailedStep: (
            input: StopFailedStepRequest,
        ): Promise<
            | {
                  id: string
                  status: string
              }
            | undefined
        > => runner.runImmediate(() => stop.trigger(input), t("salesActionStopped")),
        saveContract: (
            input: SaveContractRequest,
        ): Promise<
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
        > => runner.runImmediate(() => contract.trigger(input), t("contractSaved")),
        markOrderShipped: (
            input: MarkOrderShippedRequest,
        ): Promise<
            | {
                  id: string
                  notificationId: string
                  orderNo: string
              }
            | undefined
        > => runner.runShipment(() => shipment.trigger(input)),
        isMutating: stop.isMutating || contract.isMutating || shipment.isMutating,
    }
}
