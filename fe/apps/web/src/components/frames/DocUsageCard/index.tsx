import { Alert, Grid, Meter, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { LimitCardView, UsageLimitsView } from "@/modules/types"

/** What the usage block draws. */
interface DocUsageCardProps {
    readonly limits: UsageLimitsView
    readonly isLoading: boolean
}

/** What one meter card draws. */
interface LimitCardProps {
    readonly card: LimitCardView
    readonly isLoading: boolean
}

/** One measure card: its name and reading, the meter in the foreground colour (never red: red is the one main CTA), and the muted line under it. */
const LimitCard = (props: LimitCardProps) => (
    <SurfaceCard ariaLabel={props.card.label} isLoading={props.isLoading}>
        <Stack gap="row">
            <Meter
                tone="foreground"
                label={props.card.label}
                valueLabel={props.card.valueLabel}
                value={props.card.value}
                minValue={0}
                maxValue={props.card.max}
                isLoading={props.isLoading}
            />
            <Text size="xs" tone="muted" isLoading={props.isLoading}>
                {props.card.caption}
            </Text>
        </Stack>
    </SurfaceCard>
)

/**
 * The usage block at the top of the documents list: two separate white cards side by side, the documents against the documents limit of the
 * Second Brain and the truths in force against their ceiling, each a reading with its line under it. When the limit is
 * used up a neutral notice stands above them; from 90 % only the line under the first meter changes.
 */
export const DocUsageCard = (props: DocUsageCardProps) => {
    const { limits } = props
    return (
        <Stack gap="row">
            {limits.full === null ? null : (
                <Alert tone="neutral" title={limits.full.title} description={limits.full.body} />
            )}
            <Grid kind="cards" columns={2} align="stretch">
                {limits.cards.map((card) => (
                    <LimitCard key={card.id} card={card} isLoading={props.isLoading} />
                ))}
            </Grid>
        </Stack>
    )
}
