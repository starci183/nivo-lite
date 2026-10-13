import {
    DescriptionList,
    EmptyNotice,
    ListItem,
    Meter,
    SurfaceCard,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { ROW_CLASS, STACK_CLASS } from "./classNames"

/** Props for {@link BookingStatsBase}. */
export interface BookingStatsBaseProps {
    readonly props: {
        readonly rangeText: string
        readonly label: string
        readonly stats: ReadonlyArray<DescriptionListStatItem>
        readonly utilisationLabel: string
        readonly utilisationEmpty: string
        readonly resources: ReadonlyArray<{
            readonly id: string
            readonly name: string
            readonly pct: number
            readonly valueLabel: string
            readonly hoursText: string
        }>
    }
}

/** Draws the statistics of the range: the totals and the utilisation of each person or room. */
export const BookingStatsBase = (props: BookingStatsBaseProps) => (
    <div className={STACK_CLASS}>
        <Text size="sm" tone="muted">
            {props.props.rangeText}
        </Text>
        <SurfaceCard ariaLabel={props.props.label}>
            <DescriptionList layout="stat-strip" isDivided items={props.props.stats} />
        </SurfaceCard>
        <SurfaceListCard
            label={props.props.utilisationLabel}
            empty={<EmptyNotice message={props.props.utilisationEmpty} />}
        >
            {props.props.resources.map((resource) => (
                <ListItem key={resource.id} className={ROW_CLASS}>
                    <Meter
                        label={resource.name}
                        value={resource.pct}
                        minValue={0}
                        maxValue={100}
                        valueLabel={resource.valueLabel}
                    />
                    <Text size="xs" tone="muted">
                        {resource.hoursText}
                    </Text>
                </ListItem>
            ))}
        </SurfaceListCard>
    </div>
)
