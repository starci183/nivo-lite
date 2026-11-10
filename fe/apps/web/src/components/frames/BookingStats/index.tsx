import type { BookingStatisticsData } from "@/modules/types"
import { EmptyNotice, Meter, Section, Stack, SurfaceCard, Text } from "@starci/grammar/common"

type ReadyProps = Omit<BookingStatisticsData, "slot" | "slotLabels">

/** Resolved BookingStats fields and atomic commands; read status remains in its owning workbench. */
type BookingStatsProps = ReadyProps & { readonly isLoading: boolean }

/** Draws the statistics of the range: the totals and the utilisation of each person or room. */
export const BookingStats = (props: BookingStatsProps) => (
    <Stack gap="row">
        <Text isLoading={props.isLoading} size="sm" tone="muted">
            {props.rangeText}
        </Text>
        <SurfaceCard isLoading={props.isLoading} kind="figures" ariaLabel={props.label} items={props.stats} />
        <Section
            isLoading={props.isLoading}
            kind="list"
            title={props.utilisationLabel}
            empty={<EmptyNotice message={props.utilisationEmpty} />}
            items={props.resources.map((resource) => ({
                id: resource.id,
                title: resource.name,
                detail: (
                    <Meter
                        label={resource.name}
                        value={resource.pct}
                        minValue={0}
                        maxValue={100}
                        valueLabel={resource.valueLabel}
                    />
                ),
                description: resource.hoursText,
            }))}
        />
    </Stack>
)
