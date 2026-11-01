import { Text } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AccountingBlock } from "@/components/leaves/AccountingBlock"
import { AccountingHeadLine } from "@/components/leaves/AccountingHeadLine"
import { AccountingRecordList } from "@/components/leaves/AccountingRecordList"

/** One status mark on a row. */
interface AccountingSectionBadge {
    readonly id: string
    readonly label: string
    readonly tone: "success" | "warning" | "neutral" | "accent"
    readonly isDot: boolean
}

/** One record of the list. */
interface AccountingSectionRecord {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badges: ReadonlyArray<AccountingSectionBadge>
    readonly amount: string
    readonly footnote: string
}

/** A titled section of records: heading, optional action and form, the list and an optional closing note. */
interface AccountingRecordSectionProps {
    readonly title: string
    readonly intro: string
    readonly empty: string
    readonly emptyBody: string
    readonly records: ReadonlyArray<AccountingSectionRecord>
    readonly note?: string
    /** An action beside the heading. */
    readonly action?: ReactNode
    /** Content between the heading and the list, such as a form. */
    readonly children?: ReactNode
    readonly onOpen?: (id: string) => void
    /** The section is a placeholder: its leaves draw as skeleton. */
    readonly isSkeleton: boolean
}

/** A region with a heading, an optional action and form, the record list and a closing note. */
export const AccountingRecordSection = (props: AccountingRecordSectionProps) => (
    <AccountingBlock label={props.title}>
        <AccountingHeadLine title={props.title} intro={props.intro} isSkeleton={props.isSkeleton}>
            {props.action}
        </AccountingHeadLine>
        {props.children}
        <AccountingRecordList
            label={props.title}
            empty={props.empty}
            emptyBody={props.emptyBody}
            records={props.records}
            onOpen={props.onOpen}
            isSkeleton={props.isSkeleton}
        />
        {props.note === undefined ? null : (
            <Text size="xs" tone="muted" isSkeleton={props.isSkeleton}>
                {props.note}
            </Text>
        )}
    </AccountingBlock>
)
