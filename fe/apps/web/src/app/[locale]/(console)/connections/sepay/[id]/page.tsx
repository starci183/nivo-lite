import { SepayConnectionPage } from "@/features/pages/SepayConnectionPage"

/** The document title of the SePay connection page. */
export { sepayConnectionMetadata as generateMetadata } from "@/features/pages/SepayConnectionPage"

type PageProps = { readonly params: Promise<{ id: string }> }

/** One SePay connection: how to paste it into SePay, how to test it, which agents use it, and its live webhook events. */
const Page = async (props: PageProps) => <SepayConnectionPage connectionId={(await props.params).id} />

export default Page
