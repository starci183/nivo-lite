import type { ReactElement } from "react"
import { OnboardingRedirectPage } from "@/features/pages/OnboardingRedirectPage"

export { workspacePaymentMetadata as generateMetadata } from "@/features/pages/WorkspacePaymentPage"

type PageProps = { readonly searchParams: Promise<Record<string, string | undefined>> }

/** The old payment url: forwards its query to the payment page of a new workspace. */
const Page = async (props: PageProps): Promise<ReactElement> => (
    <OnboardingRedirectPage target="/workspaces/new/payment" search={await props.searchParams} />
)

export default Page
