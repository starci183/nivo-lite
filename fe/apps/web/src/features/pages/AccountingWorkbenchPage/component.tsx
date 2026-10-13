import { AccountingEvidencePanel } from "@/components/blocks/AccountingEvidencePanel"
import { AccountingFigures } from "@/components/blocks/AccountingFigures"
import { AccountingLedgerPanel } from "@/components/blocks/AccountingLedgerPanel"
import { AccountingOverviewPanel } from "@/components/blocks/AccountingOverviewPanel"
import { AccountingQuestionsPanel } from "@/components/blocks/AccountingQuestionsPanel"
import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"

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
    const tabs = [
        { id: "overview", label: p.tabs.overview, content: <AccountingOverviewPanel /> },
        { id: "evidence", label: p.tabs.evidence, content: <AccountingEvidencePanel /> },
        { id: "questions", label: p.tabs.questions, content: <AccountingQuestionsPanel /> },
        { id: "ledger", label: p.tabs.ledger, content: <AccountingLedgerPanel /> },
    ]
    return (
        <AgentDashboardFrame
            module="accounting"
            installationId={p.installationId}
            initialTab={p.initialTab}
            ribbon={<AccountingFigures />}
            waitingTab="questions"
            tabs={tabs}
        />
    )
}
