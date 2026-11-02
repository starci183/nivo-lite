import { AccountingWorkbench } from "@/components/blocks/AccountingWorkbench"

/** Props for {@link AccountingWorkbenchPageBase}. */
export interface AccountingWorkbenchPageBaseProps {
    readonly props: {
        readonly installationId: string | null
        readonly initialTab: string | null
        readonly tabs: {
            readonly overview: string
            readonly evidence: string
            readonly questions: string
            readonly ledger: string
        }
    }
}

/** Draws the Accounting workbench: the agent dashboard frame around the period overview, the evidence, the questions and the ledger. */
export const AccountingWorkbenchPageBase = (props: AccountingWorkbenchPageBaseProps) => {
    const p = props.props
    return <AccountingWorkbench installationId={p.installationId} initialTab={p.initialTab} tabs={p.tabs} />
}
