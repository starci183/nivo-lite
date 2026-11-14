import { ConnectionOpenPage } from "@/features/pages/ConnectionOpenPage"

/** The document title of this page. */
export { connectionOpenMetadata as generateMetadata } from "@/features/pages/ConnectionOpenPage"

type PageProps = {
    readonly params: Promise<{ readonly id: string }>
}

/** Adapts the trigger tab of a connected account's page to its page owner. */
const Page = (props: PageProps) => <ConnectionOpenPage params={props.params} tab="trigger" />

export default Page
