import { ConnectionOpenPage } from "@/features/pages/ConnectionOpenPage"

/** The document title of this page. */
export { connectionOpenMetadata as generateMetadata } from "@/features/pages/ConnectionOpenPage"

type PageProps = {
    readonly params: Promise<{ readonly id: string }>
}

/** Adapts a connected account's page to its page owner: the page itself is the Configuration tab. */
const Page = (props: PageProps) => <ConnectionOpenPage params={props.params} />

export default Page
