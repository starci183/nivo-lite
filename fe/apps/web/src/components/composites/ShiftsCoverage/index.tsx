import { Grid, Meter, Stack, SurfaceCard, Section } from "@starci/grammar/common"
import type { ShiftsWeekViews } from "@/modules/types"
type ShiftsCoverageProps = ShiftsWeekViews["coverage"] & {
    readonly isLoading?: boolean
}
/** Draws the seven real weekday regions, with read-derived dates and coverage meters in their unchanged order. */
export const ShiftsCoverage = (props: ShiftsCoverageProps) => (
    <Section
        title={props.title}
        description={props.hint}
        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
    >
        <Grid kind="week-summary" label={props.title}>
            {props.dayLabels.map((column, index) => {
                const day = props.days[index]
                return (
                    <SurfaceCard
                        key={day?.id ?? column.id}
                        label={day?.label ?? column.label}
                        headingLevel={3}
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                    >
                        <Stack gap="row">
                            {(day?.meters ?? []).map((meter) => (
                                <Meter
                                    key={meter.id}
                                    label={meter.label}
                                    value={meter.value}
                                    maxValue={meter.max}
                                    valueLabel={meter.reading}
                                    tone={meter.tone}
                                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                                />
                            ))}
                        </Stack>
                    </SurfaceCard>
                )
            })}
        </Grid>
    </Section>
)
