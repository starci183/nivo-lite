import { Stack, Section } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** The name of a region and what it holds. */
interface AccountingBlockProps {
    readonly label: string
    readonly description?: string
    readonly children: ReactNode
}

/** One named region of an Accounting panel: its parts stacked under one heading. */
export const AccountingBlock = (props: AccountingBlockProps) => (
    <Section
        title={props.label}
        {...(props.description === undefined ? {} : { description: props.description })}
        headingLevel={3}
    >
        <Stack gap="row">{props.children}</Stack>
    </Section>
)
