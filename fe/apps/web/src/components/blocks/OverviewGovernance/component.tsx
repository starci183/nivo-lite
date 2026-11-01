import { Skeleton, Stack, SurfaceCard, Text } from "@starci/grammar/common"
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

/** The words and figures of the governance blocks; the figures are null while the flow data could not be read. */
interface OverviewGovernanceBaseProps {
    readonly props: {
        readonly unavailable: string
        readonly resultsTitle: string
        readonly figures: OverviewGovernanceFigures | null
        /** The dashboard is still read: one card draws as skeleton lines in place of the five blocks. */
        readonly isSkeleton: boolean
    }
}

/** The five governance blocks of the operating flow: overview, results by status, waiting, exceptions, decision history. */
export const OverviewGovernanceBase = (props: OverviewGovernanceBaseProps) => {
    const figures = props.props.figures
    if (props.props.isSkeleton) {
        return (
            <SurfaceCard ariaLabel={props.props.resultsTitle}>
                <Skeleton shape="text" lines={4} />
            </SurfaceCard>
        )
    }
    if (figures === null) {
        return (
            <SurfaceCard ariaLabel={props.props.resultsTitle}>
                <Text tone="muted">{props.props.unavailable}</Text>
            </SurfaceCard>
        )
    }
    return (
        <Stack gap="row">
            <OverviewGovSummary figures={figures.summary} />
            <OverviewGovResults figures={figures.results} />
            <OverviewGovWaiting figures={figures.waiting} />
            <OverviewGovExceptions figures={figures.exceptions} />
            <OverviewGovHistory figures={figures.history} />
        </Stack>
    )
}
