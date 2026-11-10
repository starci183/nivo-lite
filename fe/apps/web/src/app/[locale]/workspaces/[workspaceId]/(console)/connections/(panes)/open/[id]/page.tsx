import { ConnectionOpenPage } from "@/features/pages/ConnectionOpenPage"

/** The document title of this page. */
export { connectionOpenMetadata as generateMetadata } from "@/features/pages/ConnectionOpenPage"

type PageProps = {
    readonly params: Promise<{ readonly id: string }>
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Adapts the open-connection route to its page owner; the query names the open tab. */
const Page = (props: PageProps) => <ConnectionOpenPage params={props.params} searchParams={props.searchParams} />

export default Page
