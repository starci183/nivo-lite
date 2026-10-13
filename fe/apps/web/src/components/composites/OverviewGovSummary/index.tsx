import { SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/branches/AccountingBlock"
import type { GovDepartment } from "@/hooks/overviewGov"
import { STACK_CLASS_NAME, DEPT_GRID_CLASS_NAME, TILE_COPY_CLASS_NAME } from "./classNames"

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
                <div className={STACK_CLASS_NAME}>
                    <Text weight="semibold">{props.figures.sentence}</Text>
                    <Text size="sm" tone="muted">
                        {props.figures.median}
                    </Text>
                    <div className={DEPT_GRID_CLASS_NAME}>
                        {tiles.map(({ department, action }) => (
                            <SurfaceCard key={department.id} depth="nested" wholeAction={action}>
                                <div className={TILE_COPY_CLASS_NAME}>
                                    <Text weight="semibold">{department.name}</Text>
                                    <Text size="sm">{department.done}</Text>
                                    <Text size="sm" tone={department.hasWaiting ? "accent" : "muted"}>
                                        {department.waiting}
                                    </Text>
                                    <Text size="xs" tone="muted">
                                        {department.last}
                                    </Text>
                                </div>
                            </SurfaceCard>
                        ))}
                    </div>
                </div>
            </SurfaceCard>
        </AccountingBlock>
    )
}
