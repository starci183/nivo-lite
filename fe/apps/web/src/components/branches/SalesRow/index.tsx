import type { ReactNode } from "react"
import { ListRow, Text, TextAction } from "@starci/grammar/common"

/** The parts of one Sales row: marks, who it is about, the detail lines and the commands. */
type SalesRowProps = {
    /** The in-page anchor a link can jump to. */
    readonly id?: string
    readonly isFocused?: boolean
    /** Badges and facts on the first line. */
    readonly chips: ReactNode
    /** Who the row is about; empty draws no name. */
    readonly customer: string
    readonly customerHref: string | null
    /** The detail lines under the name. */
    readonly children?: ReactNode
    /** The commands at the end of the row. */
    readonly actions?: ReactNode
    /** What opens from the row, such as a drawer. */
    readonly aside?: ReactNode
}

/** One row of a Sales collection: chips, the customer as text or a link, detail lines, commands. */
export const SalesRow = (props: SalesRowProps) => {
    const name =
        props.customerHref === null ? (
            props.customer
        ) : (
            <TextAction href={props.customerHref}>{props.customer}</TextAction>
        )
    return (
        <ListRow
            title={
                <Text as="span" weight="semibold" {...(props.id === undefined ? {} : { id: props.id })}>
                    {props.customer === "" ? null : name}
                </Text>
            }
            badges={props.chips}
            actions={props.actions}
            state={props.isFocused ? "informative" : "neutral"}
        >
            {props.children}
            {props.aside}
        </ListRow>
    )
}
