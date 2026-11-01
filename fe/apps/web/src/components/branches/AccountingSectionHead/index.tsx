import { Tabs } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AccountingBlock } from "@/components/leaves/AccountingBlock"
import { AccountingHeadLine } from "@/components/leaves/AccountingHeadLine"

/** One choice of the section's peer selector. */
interface AccountingSectionChoice {
    readonly id: string
    readonly label: string
}

/** A named region whose heading carries a peer choice (a period, a type) on its right, over the section's content. */
interface AccountingSectionHeadProps {
    readonly title: string
    readonly intro: string
    readonly choiceLabel: string
    readonly choices: ReadonlyArray<AccountingSectionChoice>
    readonly selectedChoice: string
    readonly onChoose: (id: string) => void
    readonly children: ReactNode
    /** The section is a placeholder: its heading draws as skeleton. */
    readonly isSkeleton: boolean
}

/** The heading line of a section: title and intro, with the choice that changes what the section shows, then its content. */
export const AccountingSectionHead = (props: AccountingSectionHeadProps) => (
    <AccountingBlock label={props.title}>
        <AccountingHeadLine title={props.title} intro={props.intro} isSkeleton={props.isSkeleton}>
            <Tabs
                label={props.choiceLabel}
                selectedKey={props.selectedChoice}
                inset="none"
                labelVisibility="always"
                items={props.choices}
                onSelect={props.onChoose}
            />
        </AccountingHeadLine>
        {props.children}
    </AccountingBlock>
)
