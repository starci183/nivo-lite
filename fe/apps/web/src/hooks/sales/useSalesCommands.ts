import { useTranslations } from "next-intl"
import { useMutateMarkOrderShippedSwr, useMutateSaveContractSwr, useMutateStopFailedStepSwr } from "@/hooks/swr"
import type { MarkOrderShippedRequest, SaveContractRequest, StopFailedStepRequest } from "@/modules/api"
import type { SalesActionRunner } from "./useSalesActionRunner"

/** The Sales writes the back end answers at once: stopping a failed step, saving a contract and marking an order shipped. */
export const useSalesCommands = (runner: SalesActionRunner) => {
    const t = useTranslations("workbenchSales")
    const stop = useMutateStopFailedStepSwr()
    const contract = useMutateSaveContractSwr()
    const shipment = useMutateMarkOrderShippedSwr()
    return {
        stopFailedStep: (input: StopFailedStepRequest) =>
            runner.runImmediate(() => stop.trigger(input), t("salesActionStopped")),
        saveContract: (input: SaveContractRequest) =>
            runner.runImmediate(() => contract.trigger(input), t("contractSaved")),
        markOrderShipped: (input: MarkOrderShippedRequest) => runner.runShipment(() => shipment.trigger(input)),
        isMutating: stop.isMutating || contract.isMutating || shipment.isMutating,
    }
}
