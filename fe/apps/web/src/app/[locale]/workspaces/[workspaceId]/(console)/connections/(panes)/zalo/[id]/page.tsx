import { ZaloConnectionPage } from "@/features/pages/ZaloConnectionPage"

/** The document title of this page. */
export { zaloConnectionMetadata as generateMetadata } from "@/features/pages/ZaloConnectionPage"

type PageProps = {
    readonly params: Promise<{ readonly id: string }>
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Adapts the Zalo OA connection route to its page owner; the query names the open tab. */
const Page = (props: PageProps) => <ZaloConnectionPage params={props.params} searchParams={props.searchParams} />

export default Page
