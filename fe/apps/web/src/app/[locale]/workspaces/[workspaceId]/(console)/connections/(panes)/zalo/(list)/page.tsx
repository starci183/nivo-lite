import type { ReactElement } from "react"
import type { Metadata } from "next"
import { ConnectionProviderPage, connectionProviderMetadata } from "@/features/pages/ConnectionProviderPage"

/** The document title of this page. */
export const generateMetadata = (): Promise<Metadata> => connectionProviderMetadata("zalo")

/** Adapts the zalo provider route to its page owner. */
const Page = (): ReactElement => <ConnectionProviderPage segment="zalo" />

export default Page
