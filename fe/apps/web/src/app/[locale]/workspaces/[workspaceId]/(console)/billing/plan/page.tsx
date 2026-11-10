import type { ReactElement } from "react"
import { BillingPlanPage } from "@/features/pages/BillingPlanPage"

export { billingPlanMetadata as generateMetadata } from "@/features/pages/BillingPlanPage"

/** What the page receives from Next. */
interface BillingPlanRouteProps {
    readonly params: Promise<{ readonly workspaceId: string }>
}

/** The plan change: the plans side by side and the priced change. */
const Page = async ({ params }: BillingPlanRouteProps): Promise<ReactElement> => {
    const { workspaceId } = await params
    return <BillingPlanPage workspaceId={workspaceId} />
}

export default Page
