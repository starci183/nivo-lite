import type { ReactNode } from "react"
import { Cluster, Stack } from "@starci/grammar/common"

/** The parts of one Sales row: marks, who it is about, the detail lines and the commands. */
type SalesRowProps = {
    /** The in-page anchor a link can jump to. */
    readonly id?: string
    /** Badges and facts on the first line. */
    readonly chips: ReactNode
    /** The detail lines under the name. */
    readonly body?: ReactNode
    /** The commands at the end of the row. */
    readonly actions?: ReactNode
    /** What opens from the row, such as a drawer. */
    readonly aside?: ReactNode
}

/** Carries a sales item's stable identity, destination and existing detail into the Grammar collection. */
export const SalesRow = (props: SalesRowProps) => {
    return (
        <div {...(props.id === undefined ? {} : { id: props.id })}>
            <Stack gap="row">
                <Cluster gap="inline" justify="between">
                    {props.chips}
                    {props.actions}
                </Cluster>
                {props.body}
                {props.aside}
            </Stack>
        </div>
    )
}
