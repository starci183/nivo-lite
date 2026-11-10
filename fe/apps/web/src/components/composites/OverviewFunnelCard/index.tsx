import { Meter, Stack, SurfaceCard } from "@starci/grammar/common"
import type { OverviewFunnelStepView } from "@/modules/types"

/** What the funnel card is told. */
interface OverviewFunnelCardProps {
    readonly props: {
        readonly title: string
        readonly note: string
        readonly steps: ReadonlyArray<OverviewFunnelStepView>
        readonly isLoading: boolean
    }
}

/** The sales funnel: how many customers came in, were advised, ordered and paid, each a meter against those who came in. */
export const OverviewFunnelCard = (props: OverviewFunnelCardProps) => (
    <SurfaceCard label={props.props.title} fact={props.props.note} headingLevel={2} isLoading={props.props.isLoading}>
        <Stack gap="row">
            {props.props.steps.map((step) => (
                <Meter
                    key={step.id}
                    label={step.label}
                    value={step.value}
                    minValue={0}
                    maxValue={step.max}
                    valueLabel={step.valueLabel}
                    tone="neutral"
                    isLoading={props.props.isLoading}
                />
            ))}
        </Stack>
    </SurfaceCard>
)
