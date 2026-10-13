import { BillingPage } from "@/features/pages/BillingPage"

export { billingMetadata as generateMetadata } from "@/features/pages/BillingPage"

type PageProps = { readonly params: Promise<{ id: string }> }

/** Plan, payments and renewal of one workspace (owner | manager). */
const Page = async ({ params }: PageProps) => {
    const { id } = await params
    return <BillingPage workspaceId={id} />
}

export default Page
