import { EmptyNotice, Section } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { COLUMN_CLASS } from "./classNames"
import type { GuideRowView } from "./types"

/** One lifted list of rows in the thread: the things to do here, or one group of search results. */
interface GuideRowsCardProps {
    readonly props: {
        /** The group's label in small muted words above the rows; none for the todo list, which the line above names. */
        readonly label: string | null
        /** The accessible name of the list. */
        readonly name: string
        readonly rows: ReadonlyArray<GuideRowView>
    }
    readonly on: {
        readonly open: (id: string) => void
    }
}

/**
 * A list of rows that stands in the bubbles' column. The list is the lifted card (the section list draws its own face); every row opens
 * whole and Grammar ends it with its chevron.
 */
export const GuideRowsCard = (props: GuideRowsCardProps) => (
    <div className={COLUMN_CLASS}>
        <Section
            kind="list"
            {...(props.props.label === null ? { ariaLabel: props.props.name } : { sublabel: props.props.label })}
            items={props.props.rows.map((row) => ({
                id: row.id,
                title: row.title,
                ...(row.description === undefined || row.description === "" ? {} : { description: row.description }),
                leading: { icon: nivoIconSource(row.icon, "leading"), size: "sm" as const },
                ...(row.meta === undefined ? {} : { meta: { text: row.meta } }),
                onPress: () => props.on.open(row.id),
            }))}
            empty={<EmptyNotice message={props.props.name} />}
        />
    </div>
)
