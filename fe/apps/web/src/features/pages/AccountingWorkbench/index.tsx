import { AccountingWorkbenchOverview } from "@/components/blocks/AccountingWorkbenchOverview"
/** The initial accounting tab selected by the route. */
interface AccountingWorkbenchProps {
    readonly tab?: string | null
}
/** Server shell mounting the complete connected accounting workbench. */
export const AccountingWorkbench = (props: AccountingWorkbenchProps) => (
    <AccountingWorkbenchOverview key={props.tab ?? "overview"} initialTab={props.tab ?? null} />
)
