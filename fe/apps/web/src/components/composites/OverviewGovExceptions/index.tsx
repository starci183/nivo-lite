import { Badge, Cluster, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { GovExceptionChip } from "@/hooks/overviewGov"

/** The figures of the exceptions block. */
export interface OverviewGovExceptionsProps {
    readonly figures: {
        readonly title: string
        readonly none: string
        readonly total: string | null
        readonly chips: ReadonlyArray<GovExceptionChip>
        readonly source: string
    }
}

/** The work that stopped, by the reason NIVO gave. */
export const OverviewGovExceptions = (props: OverviewGovExceptionsProps) => (
    <SurfaceCard label={props.figures.title} headingLevel={2}>
        <Stack gap="row">
            {props.figures.total === null ? (
                <Text tone="muted">{props.figures.none}</Text>
            ) : (
                <>
                    <Text weight="semibold">{props.figures.total}</Text>
                    <Cluster gap="inline">
                        {props.figures.chips.map((chip) => (
                            <Badge key={chip.id} tone={chip.tone}>
                                {chip.label}
                            </Badge>
                        ))}
                    </Cluster>
                </>
            )}
            <Text size="xs" tone="muted">
                {props.figures.source}
            </Text>
        </Stack>
    </SurfaceCard>
)
