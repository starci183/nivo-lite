import { Region } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { BLOCK_CLASS_NAME } from "./classNames"

/** The name of a region and what it holds. */
interface AccountingBlockProps {
    readonly label: string
    readonly children: ReactNode
}

/** One named region of an Accounting panel: its parts stacked under one heading. */
export const AccountingBlock = (props: AccountingBlockProps) => (
    <Region label={props.label}>
        <div className={BLOCK_CLASS_NAME}>{props.children}</div>
    </Region>
)
