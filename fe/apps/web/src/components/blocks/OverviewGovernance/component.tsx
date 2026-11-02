import { Stack } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { OverviewGovSummary, type OverviewGovSummaryProps } from "@/components/composites/OverviewGovSummary"
import { OverviewGovResults, type OverviewGovResultsProps } from "@/components/composites/OverviewGovResults"
import { OverviewGovWaiting, type OverviewGovWaitingProps } from "@/components/composites/OverviewGovWaiting"
import { OverviewGovExceptions, type OverviewGovExceptionsProps } from "@/components/composites/OverviewGovExceptions"
import { OverviewGovHistory, type OverviewGovHistoryProps } from "@/components/composites/OverviewGovHistory"

/** Every block of the governance section, as plain words. */
export interface OverviewGovernanceFigures {
    readonly summary: OverviewGovSummaryProps["figures"]
    readonly results: OverviewGovResultsProps["figures"]
    readonly waiting: OverviewGovWaitingProps["figures"]
    readonly exceptions: OverviewGovExceptionsProps["figures"]
    readonly history: OverviewGovHistoryProps["figures"]
}

/** The five ready regions and their one dashboard read, with the same anatomy while the read is loading. */
interface OverviewGovernanceBaseProps {
    readonly props: {
        readonly slot: DataSlot<OverviewGovernanceFigures>
        readonly placeholder: OverviewGovernanceFigures
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** The five governance blocks of the operating flow: overview, results by status, waiting, exceptions, decision history. */
export const OverviewGovernanceBase = (props: OverviewGovernanceBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(figures, isLoading) => (
            <Stack gap="row">
                <OverviewGovSummary figures={figures.summary} isLoading={isLoading} />
                <OverviewGovResults figures={figures.results} isLoading={isLoading} />
                <OverviewGovWaiting figures={figures.waiting} isLoading={isLoading} />
                <OverviewGovExceptions figures={figures.exceptions} isLoading={isLoading} />
                <OverviewGovHistory figures={figures.history} isLoading={isLoading} />
            </Stack>
        )}
    />
)
