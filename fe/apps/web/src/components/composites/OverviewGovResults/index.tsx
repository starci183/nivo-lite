import { Cluster, EmptyNotice, Link, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { GovStatusRow } from "@/hooks/overviewResults"

/** The figures of the results block. */
export interface OverviewGovResultsProps {
    readonly isLoading?: boolean
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
    <Stack gap="row">
        <SurfaceCard
            kind="list"
            label={props.figures.title}
            isLoading={props.isLoading === true}
            footer={[props.figures.intro, props.figures.testNote].filter((line) => line !== "").join(" · ")}
            empty={<EmptyNotice message={props.figures.title} />}
            items={props.figures.rows.map((row) => ({
                id: row.id,
                title: row.label,
                description: row.context,
                detail: (
                    <Stack gap="identity" align="end">
                        <Text isStrong isLoading={props.isLoading === true}>
                            {row.value}
                        </Text>
                        {row.count === null ? null : (
                            <Text size="xs" tone="muted" isLoading={props.isLoading === true}>
                                {row.count}
                            </Text>
                        )}
                    </Stack>
                ),
            }))}
        />
        <Stack gap="row">
            <Text size="sm" tone="muted">
                {props.figures.service}
            </Text>
            {props.figures.goals.map((goal) => (
                <Cluster key={goal.id} gap="row">
                    <Text size="sm" {...(goal.isSet ? {} : { tone: "muted" as const })}>
                        {goal.text}
                    </Text>
                    {goal.isSet ? null : <Link href={props.figures.goalHref}>{props.figures.goalSetLabel}</Link>}
                </Cluster>
            ))}
        </Stack>
    </Stack>
)
