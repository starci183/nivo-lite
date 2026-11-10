import { SepayConnectionPage } from "@/features/pages/SepayConnectionPage"

/** The document title of this page. */
export { sepayConnectionMetadata as generateMetadata } from "@/features/pages/SepayConnectionPage"

type PageProps = {
    readonly params: Promise<{ readonly id: string }>
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Adapts the SePay connection route to its page owner; the query names the open tab. */
const Page = (props: PageProps) => <SepayConnectionPage params={props.params} searchParams={props.searchParams} />

export default Page
