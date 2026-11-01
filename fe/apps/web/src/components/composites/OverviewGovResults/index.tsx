import { Cluster, ListRow, SectionHeader, Stack, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/branches/AccountingBlock"
import type { GovStatusRow } from "@/hooks/overviewResults"

/** The figures of the results block. */
export interface OverviewGovResultsProps {
    readonly figures: {
        readonly title: string
        readonly intro: string
        readonly rows: ReadonlyArray<GovStatusRow>
        readonly service: string
        readonly goals: ReadonlyArray<{ readonly id: string; readonly text: string; readonly isSet: boolean }>
        readonly goalHref: string
        readonly goalSetLabel: string
        readonly testNote: string
    }
}

/** The results by status, each figure naming what it rests on: one row per status in one list, the notes under it. */
export const OverviewGovResults = (props: OverviewGovResultsProps) => (
    <AccountingBlock label={props.figures.title}>
        <SectionHeader level={2} title={props.figures.title} description={props.figures.intro} />
        <SurfaceListCard ariaLabel={props.figures.title} footer={props.figures.testNote}>
            {props.figures.rows.map((row) => (
                <ListRow
                    key={row.id}
                    title={row.label}
                    description={row.context}
                    actions={
                        <Stack gap="identity" align="end">
                            <Text weight="semibold">{row.value}</Text>
                            {row.count === null ? null : (
                                <Text size="xs" tone="muted">
                                    {row.count}
                                </Text>
                            )}
                        </Stack>
                    }
                />
            ))}
        </SurfaceListCard>
        <Stack gap="row">
            <Text size="sm" tone="muted">
                {props.figures.service}
            </Text>
            {props.figures.goals.map((goal) => (
                <Cluster key={goal.id} gap="row">
                    <Text size="sm" {...(goal.isSet ? {} : { tone: "muted" as const })}>
                        {goal.text}
                    </Text>
                    {goal.isSet ? null : (
                        <TextAction href={props.figures.goalHref}>{props.figures.goalSetLabel}</TextAction>
                    )}
                </Cluster>
            ))}
        </Stack>
    </AccountingBlock>
)
