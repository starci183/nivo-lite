import { AccountingWorkbench } from "@/features/pages/AccountingWorkbench"

/** Legacy entry of the module workbench registry (props: tab, focus, installation); removed with the registry rewrite in wave 3. */
const WorkbenchAccounting = (props: Record<string, unknown>) => (
    <AccountingWorkbench tab={typeof props.tab === "string" ? props.tab : null} />
)

export default WorkbenchAccounting
