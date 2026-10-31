import { Grid, SectionHeader, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/branches/AccountingBlock"
import type { GovDepartment } from "@/hooks/overviewGov"

/** The figures of the summary block. */
export interface OverviewGovSummaryProps {
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
        action: { kind: "link" as const, href: props.figures.chatHref, label: department.label },
    }))
    return (
        <AccountingBlock label={props.figures.title}>
            <SectionHeader level={2} title={props.figures.title} description={props.figures.motto} />
            <SurfaceCard ariaLabel={props.figures.title}>
                <Stack gap="row">
                    <Text weight="semibold">{props.figures.sentence}</Text>
                    <Text size="sm" tone="muted">
                        {props.figures.median}
                    </Text>
                    <Grid kind="cards" columns={3}>
                        {tiles.map(({ department, action }) => (
                            <SurfaceCard key={department.id} wholeAction={action}>
                                <Stack gap="identity">
                                    <Text weight="semibold">{department.name}</Text>
                                    <Text size="sm">{department.done}</Text>
                                    <Text size="sm" tone={department.hasWaiting ? "accent" : "muted"}>
                                        {department.waiting}
                                    </Text>
                                    <Text size="xs" tone="muted">
                                        {department.last}
                                    </Text>
                                </Stack>
                            </SurfaceCard>
                        ))}
                    </Grid>
                </Stack>
            </SurfaceCard>
        </AccountingBlock>
    )
}
