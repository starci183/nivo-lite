import { SectionHeader, Text } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AccountingBlock } from "@/components/leaves/AccountingBlock"
import { AccountingRecordList } from "@/components/leaves/AccountingRecordList"
import { HEAD_CLASS_NAME } from "./classNames"

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
}

/** A region with a heading, an optional action and form, the record list and a closing note. */
export const AccountingRecordSection = (props: AccountingRecordSectionProps) => (
    <AccountingBlock label={props.title}>
        <div className={HEAD_CLASS_NAME}>
            <SectionHeader level={2} title={props.title} description={props.intro} />
            {props.action}
        </div>
        {props.children}
        <AccountingRecordList
            label={props.title}
            empty={props.empty}
            emptyBody={props.emptyBody}
            records={props.records}
            onOpen={props.onOpen}
        />
        {props.note === undefined ? null : (
            <Text size="xs" tone="muted">
                {props.note}
            </Text>
        )}
    </AccountingBlock>
)
