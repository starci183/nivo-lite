import { Cluster, EmptyNotice, IconButton, Link, SurfaceCard, Text } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { OverviewPaneCopy, OverviewPaneReady } from "@/modules/types"

/** What the results card draws and how its disclosure is driven. */
interface OverviewResultsCardProps {
    readonly data: OverviewPaneReady["results"]
    readonly copy: OverviewPaneCopy
    readonly isOpen: boolean
    readonly onToggle: () => void
    readonly isLoading: boolean
}

/** What the notes draw. */
interface NotesProps {
    readonly goals: OverviewPaneReady["results"]["goals"]
    readonly copy: OverviewPaneCopy
}

/** The goals and the way to the decision history: the note under the list, and the whole closed card. */
const Notes = (props: NotesProps) => (
    <Cluster gap="row">
        {props.goals.map((goal) => (
            <Cluster key={goal.id} gap="inline">
                <Text size="xs" tone="muted">
                    {goal.text}
                </Text>
                {goal.isSet ? null : <Link href={CONSOLE_ROUTES.authority}>{props.copy.goalSet}</Link>}
            </Cluster>
        ))}
        <Link href={CONSOLE_ROUTES.decisions}>{props.copy.historyAll}</Link>
    </Cluster>
)

/** One status row: what it is and what it rests on, then its figure. */
const rowOf = (row: OverviewPaneReady["results"]["rows"][number], isLoading: boolean): ListRowData => ({
    id: row.id,
    title: row.label,
    ...(row.count === null ? {} : { description: row.count }),
    detail: (
        <Text isStrong isLoading={isLoading}>
            {row.value}
        </Text>
    ),
})

/** The results by status with the goals under them; the toggle folds the list away and keeps the notes. */
export const OverviewResultsCard = (props: OverviewResultsCardProps) => {
    const toggle = (
        <IconButton
            intent="neutral"
            source={nivoIconSource("disclosure", "leading")}
            label={props.isOpen ? props.copy.toggleHide : props.copy.toggleShow}
            aria-expanded={props.isOpen}
            onPress={props.onToggle}
            isLoading={props.isLoading}
        />
    )
    if (!props.isOpen) {
        return (
            <SurfaceCard label={props.copy.resultsTitle} headingLevel={2} labelEnd={toggle} isLoading={props.isLoading}>
                <Notes goals={props.data.goals} copy={props.copy} />
            </SurfaceCard>
        )
    }
    return (
        <SurfaceCard
            kind="list"
            label={props.copy.resultsTitle}
            headingLevel={2}
            labelEnd={toggle}
            isLoading={props.isLoading}
            footer={<Notes goals={props.data.goals} copy={props.copy} />}
            empty={<EmptyNotice message={props.copy.resultsTitle} />}
            items={props.data.rows.map((row) => rowOf(row, props.isLoading))}
        />
    )
}
