import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { WorkspacePaymentPageBase } from "./component"

/** Query selectors carried by a workspace payment URL. */
interface WorkspacePaymentPageProps {
    readonly searchParams: Promise<{ order?: string; ws?: string; return?: string }>
}

/** The document title of the payment step. */
export const workspacePaymentMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("onboarding")
    return { title: t("payTitle") }
}

/** The server shell; connected browser blocks read the authorized payment data. */
export const WorkspacePaymentPage = async (props: WorkspacePaymentPageProps) => {
    const selectors = await props.searchParams
    const t = await getTranslations("onboarding")
    return (
        <WorkspacePaymentPageBase
            props={{
                title: t("payTitle"),
                workspaceId: selectors.ws,
                orderId: selectors.order,
                renewing: selectors.return === "billing",
            }}
        />
    )
}
