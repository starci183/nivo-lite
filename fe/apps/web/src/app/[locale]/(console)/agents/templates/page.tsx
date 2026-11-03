import type { Metadata } from "next"
import type { ReactElement } from "react"
import { AgentTemplatesPage, agentTemplatesMetadataOf } from "@/features/pages/AgentTemplatesPage"

/** The document title of this page. */
export const generateMetadata: () => Promise<Metadata> = agentTemplatesMetadataOf("templates")

/** The templates slot. */
const Page = (): ReactElement => <AgentTemplatesPage view="templates" />

export default Page
