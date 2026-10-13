import { useTranslations } from "next-intl"
import { useMutateMarkOrderShippedSwr } from "@/hooks/swr/api/graphql/mutations/useMutateMarkOrderShippedSwr"
import { useMutateSaveContractSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveContractSwr"
import { useMutateStopFailedStepSwr } from "@/hooks/swr/api/graphql/mutations/useMutateStopFailedStepSwr"
import type { MarkOrderShippedInput, SaveContractInput, StopFailedStepInput } from "@/modules/api"
import type { SalesActionRunner } from "./useSalesActionRunner"

/** The Sales writes the back end answers at once: stopping a failed step, saving a contract and marking an order shipped. */
export const useSalesCommands = (runner: SalesActionRunner) => {
    const t = useTranslations("workbenchSales")
    const stop = useMutateStopFailedStepSwr()
    const contract = useMutateSaveContractSwr()
    const shipment = useMutateMarkOrderShippedSwr()
    return {
        stopFailedStep: (input: StopFailedStepInput) =>
            runner.runImmediate(() => stop.trigger(input), t("salesActionStopped")),
        saveContract: (input: SaveContractInput) =>
            runner.runImmediate(() => contract.trigger(input), t("contractSaved")),
        markOrderShipped: (input: MarkOrderShippedInput) => runner.runShipment(() => shipment.trigger(input)),
        isMutating: stop.isMutating || contract.isMutating || shipment.isMutating,
    }
}
