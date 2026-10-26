import type { ReactNode } from "react"
import { Divider } from "@starci/grammar/common"

/** What one separated row draws. */
type DividedRowProps = {
    readonly isFirst: boolean
    readonly children: ReactNode
}

/** One row of a stacked group: a hairline above it unless it is the first, then the row itself. */
export const DividedRow = (props: DividedRowProps) => (
    <>
        {props.isFirst ? null : <Divider semantics="presentation" />}
        {props.children}
    </>
)
