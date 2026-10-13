import { WorkspacePaymentPage } from "@/features/pages/WorkspacePaymentPage"

export { workspacePaymentMetadata as generateMetadata } from "@/features/pages/WorkspacePaymentPage"

type PageProps = { readonly searchParams: Promise<{ order?: string; ws?: string; return?: string }> }

/** The payment route forwards its URL selectors to the page owner. */
const Page = (props: PageProps) => <WorkspacePaymentPage searchParams={props.searchParams} />

export default Page
