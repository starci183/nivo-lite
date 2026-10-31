import { ZaloConnectionPage } from "@/features/pages/ZaloConnectionPage"

/** The document title of this page. */
export { zaloConnectionMetadata as generateMetadata } from "@/features/pages/ZaloConnectionPage"

type PageProps = {
    readonly params: Promise<{ readonly id: string }>
}

/** Adapts the Zalo OA connection route to its page owner. */
const Page = (props: PageProps) => <ZaloConnectionPage params={props.params} />

export default Page
