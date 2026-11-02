import type { ReactNode } from "react"
import { Section, Stack } from "@starci/grammar/common"

/** A named accounting region around its form, independently resolved rows and closing note. */
interface AccountingRecordSectionProps {
    readonly title: string
    readonly intro: string
    readonly action?: ReactNode
    readonly records: ReactNode
    readonly note?: ReactNode
    readonly children?: ReactNode
}

/** Structural copy stays in place while the owning composite resolves the record collection. */
export const AccountingRecordSection = (props: AccountingRecordSectionProps) => (
    <Section title={props.title} description={props.intro} action={props.action}>
        <Stack gap="row">
            {props.children}
            {props.records}
            {props.note}
        </Stack>
    </Section>
)
