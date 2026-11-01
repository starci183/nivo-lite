import type { ReactNode } from "react"
import { Cluster, SectionHeader } from "@starci/grammar/common"

/** The heading of an accounting section and what stands at its end. */
interface AccountingHeadLineProps {
    readonly title: string
    readonly intro: string
    /** The section is a placeholder: its heading draws as skeleton. */
    readonly isSkeleton: boolean
    /** An action or a choice beside the heading. */
    readonly children?: ReactNode
}

/** The heading line of an accounting section: title and intro, with the action or choice at its end. */
export const AccountingHeadLine = (props: AccountingHeadLineProps) => (
    <Cluster gap="row" align="end" justify="between">
        <SectionHeader level={2} title={props.title} description={props.intro} isSkeleton={props.isSkeleton} />
        {props.children}
    </Cluster>
)
