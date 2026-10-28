import { SepayConnectionPage } from "@/features/pages/SepayConnectionPage"

/** The document title of the SePay connection page. */
export { sepayConnectionMetadata as generateMetadata } from "@/features/pages/SepayConnectionPage"

type PageProps = {
    readonly params: Promise<{ id: string }>
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** One SePay connection: how to paste it into SePay, how to test it, which agents use it, and its live webhook events. */
const Page = async (props: PageProps) => {
    const { id } = await props.params
    const { tab } = await props.searchParams
    return <SepayConnectionPage connectionId={id} tab={tab} />
}

export default Page
