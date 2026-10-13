import type { ReactNode } from "react"
import { ListItem, Text, TextAction } from "@starci/grammar/common"
import {
    CHIPS_CLASS_NAME,
    ROW_ACTIONS_CLASS_NAME,
    ROW_CLASS_NAME,
    ROW_FOCUSED_CLASS_NAME,
    ROW_MAIN_CLASS_NAME,
} from "./classNames"

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
            <Text weight="semibold">{props.customer}</Text>
        ) : (
            <TextAction href={props.customerHref}>{props.customer}</TextAction>
        )
    return (
        <ListItem id={props.id} className={props.isFocused ? ROW_FOCUSED_CLASS_NAME : ROW_CLASS_NAME}>
            <div className={ROW_MAIN_CLASS_NAME}>
                <div className={CHIPS_CLASS_NAME}>{props.chips}</div>
                {props.customer === "" ? null : name}
                {props.children}
            </div>
            {props.actions === undefined ? null : <div className={ROW_ACTIONS_CLASS_NAME}>{props.actions}</div>}
            {props.aside}
        </ListItem>
    )
}
