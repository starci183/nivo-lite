"use client"

import { useAccountingWorkbenchView } from "@/hooks/accounting"
import { AccountingWorkbenchBase } from "./component"

/** The installation and resolved route atoms of the Accounting workbench. */
type AccountingWorkbenchProps = Parameters<typeof useAccountingWorkbenchView>[0]

/** Owns Accounting reads and commands and renders its pure workbench twin. */
export const AccountingWorkbench = (props: AccountingWorkbenchProps) => {
    const view = useAccountingWorkbenchView(props)
    return <AccountingWorkbenchBase {...view} />
}
