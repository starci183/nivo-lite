import { Fragment } from "react"
import { Badge, Cluster, Divider, Stack, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import type { GovHistoryRow } from "@/hooks/overviewGov"

/** The figures of the history block. */
export interface OverviewGovHistoryProps {
    readonly figures: {
        readonly title: string
        readonly allLabel: string
        readonly allHref: string
        readonly empty: string
        readonly rows: ReadonlyArray<GovHistoryRow>
        readonly source: string
    }
}

/** The latest decisions of the log. */
export const OverviewGovHistory = (props: OverviewGovHistoryProps) => (
    <SurfaceCard
        label={props.figures.title}
        headingLevel={2}
        labelEnd={
            <TextAction href={props.figures.allHref} size="sm" appearance="inline">
                {props.figures.allLabel}
            </TextAction>
        }
    >
        <Stack gap="row">
            {props.figures.rows.length === 0 ? (
                <Text tone="muted">{props.figures.empty}</Text>
            ) : (
                <Stack gap="row">
                    {props.figures.rows.map((row, index) => (
                        <Fragment key={row.id}>
                            {index > 0 ? <Divider semantics="presentation" /> : null}
                            <Stack gap="identity">
                                <Cluster gap="inline">
                                    <Text size="sm" weight="semibold">
                                        {row.action}
                                    </Text>
                                    <Badge tone={row.outcomeTone}>{row.outcome}</Badge>
                                    <Text size="xs" tone="muted">
                                        {row.when}
                                    </Text>
                                </Cluster>
                                <Text size="sm" tone="muted">
                                    {row.detail}
                                </Text>
                            </Stack>
                        </Fragment>
                    ))}
                </Stack>
            )}
            <Text size="xs" tone="muted">
                {props.figures.source}
            </Text>
        </Stack>
    </SurfaceCard>
)
