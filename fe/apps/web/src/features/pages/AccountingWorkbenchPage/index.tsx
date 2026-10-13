import { getTranslations } from "next-intl/server"
import { AccountingWorkbenchPageBase } from "./component"

/** What the agent workbench route hands the Accounting workbench. */
interface AccountingWorkbenchPageProps {
    /** `?tab=` of the route (overview, evidence, questions, ledger); anything else opens the first tab. */
    readonly tab?: string | null
    /** The Accounting agent instance the workbench opens for. */
    readonly installationId?: string
}

/** /agents/accounting/workbench: the server shell words the tabs and hands the page its ids; every panel reads its own data. */
export const AccountingWorkbenchPage = async (props: AccountingWorkbenchPageProps) => {
    const t = await getTranslations("workbenchAccounting")
    return (
        <AccountingWorkbenchPageBase
            props={{
                installationId: props.installationId ?? null,
                initialTab: props.tab ?? null,
                tabs: {
                    overview: t("tabOverview"),
                    evidence: t("tabEvidence"),
                    questions: t("tabQuestions"),
                    ledger: t("tabLedger"),
                },
            }}
        />
    )
}
