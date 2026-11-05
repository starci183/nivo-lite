import { Grid, Section, SurfaceCard } from "@starci/grammar/common"
import type { TileMark, WholeCardAction } from "@starci/grammar/common"
import type { OverviewPaneCopy, OverviewPaneReady } from "@/modules/types"

/** What the agents-of-the-week section draws. */
interface OverviewDepartmentsProps {
    readonly data: OverviewPaneReady["departments"]
    readonly copy: OverviewPaneCopy
    readonly isLoading: boolean
}

/** A tile with the mark and the destination it was built with. */
interface DepartmentTile {
    readonly department: OverviewPaneReady["departments"][number]
    readonly mark: TileMark
    readonly action: WholeCardAction
}

/** The agents of the week: one tile each with what it finished, what waits for the owner and its last activity. */
export const OverviewDepartments = (props: OverviewDepartmentsProps) => {
    const tiles: ReadonlyArray<DepartmentTile> = props.data.map((department) => ({
        department,
        mark: { avatar: { name: department.name, kind: "agent", seed: department.id } },
        action: { kind: "link", href: department.href, label: department.name },
    }))
    return (
        <Section title={props.copy.departmentsTitle} isLoading={props.isLoading}>
            <Grid kind="cards" columns={3}>
                {tiles.map(({ department, mark, action }) => (
                    <SurfaceCard
                        key={department.id}
                        kind="tile"
                        name={department.name}
                        mark={mark}
                        description={`${department.done} · ${department.waiting}`}
                        facts={department.last}
                        wholeAction={action}
                        isLoading={props.isLoading}
                    />
                ))}
            </Grid>
        </Section>
    )
}
