import type { ReactNode } from "react"
import { SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"

/** The heading, hint, empty notice and rows of a list card of the shifts screens. */
interface ShiftsListCardProps {
    readonly title: string
    readonly hint: string
    readonly empty: ReactNode
    readonly items: ReadonlyArray<ListRowData>
    readonly isLoading: boolean | undefined
}

/** A list card of the shifts screens: its title, the rows, and a muted hint as its footer. */
export const ShiftsListCard = (props: ShiftsListCardProps) => (
    <SurfaceCard
        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
        kind="list"
        label={props.title}
        headingLevel={2}
        footer={
            <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm" tone="muted">
                {props.hint}
            </Text>
        }
        empty={props.empty}
        items={props.items}
    />
)
