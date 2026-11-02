import { Grid, Section, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { GovDepartment } from "@/hooks/overviewGov"

/** The figures of the summary block. */
export interface OverviewGovSummaryProps {
    /** The summary's first read has no data yet; the grammar keeps its own geometry. */
    readonly isLoading?: boolean
    readonly figures: {
        readonly title: string
        readonly motto: string
        readonly sentence: string
        readonly median: string
        readonly chatHref: string
        readonly departments: ReadonlyArray<GovDepartment>
    }
}

/** The overview of the last 7 days: what NIVO did by itself and what waits per department. */
export const OverviewGovSummary = (props: OverviewGovSummaryProps) => {
    const tiles = props.figures.departments.map((department) => ({
        department,
        mark: { avatar: { name: department.name, seed: department.id } },
        action: { kind: "link" as const, href: props.figures.chatHref, label: department.label },
    }))
    return (
        <Section title={props.figures.title} description={props.figures.motto} isLoading={props.isLoading === true}>
            <Stack gap="row">
                <Stack gap="identity">
                    <Text isStrong isLoading={props.isLoading === true}>
                        {props.figures.sentence}
                    </Text>
                    <Text size="sm" tone="muted" isLoading={props.isLoading === true}>
                        {props.figures.median}
                    </Text>
                </Stack>
                <Grid kind="cards" columns={3}>
                    {tiles.map(({ department, action, mark }) => (
                        <SurfaceCard
                            key={department.id}
                            kind="tile"
                            name={department.name}
                            mark={mark}
                            description={`${department.done} · ${department.waiting}`}
                            wholeAction={action}
                            isLoading={props.isLoading === true}
                            footer={
                                <Text size="xs" tone="muted" isLoading={props.isLoading === true}>
                                    {department.last}
                                </Text>
                            }
                        />
                    ))}
                </Grid>
            </Stack>
        </Section>
    )
}
