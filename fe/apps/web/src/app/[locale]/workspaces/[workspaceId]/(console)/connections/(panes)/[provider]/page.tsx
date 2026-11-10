import type { ReactElement } from "react"
import type { Metadata } from "next"
import { ConnectionProviderPage, connectionProviderMetadata } from "@/features/pages/ConnectionProviderPage"

type PageProps = { readonly params: Promise<{ readonly provider: string }> }

/** The document title of this page. */
export const generateMetadata = async (props: PageProps): Promise<Metadata> =>
    connectionProviderMetadata((await props.params).provider)

/** Adapts the route of any other provider (payos, casso, openapi, webhook...) to its page owner; an unknown segment is a 404. */
const Page = async (props: PageProps): Promise<ReactElement> => (
    <ConnectionProviderPage segment={(await props.params).provider} />
)

export default Page
