import type { ReactElement } from "react"
import type { Metadata } from "next"
import { ConnectionProviderPage, connectionProviderMetadata } from "@/features/pages/ConnectionProviderPage"

/** The document title of this page. */
export const generateMetadata = (): Promise<Metadata> => connectionProviderMetadata("telegram")

/** Adapts the telegram provider route to its page owner. */
const Page = (): ReactElement => <ConnectionProviderPage segment="telegram" />

export default Page
