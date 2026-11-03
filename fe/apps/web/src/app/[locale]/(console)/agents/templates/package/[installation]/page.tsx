import type { ReactElement } from "react"
import { AgentPackagePage } from "@/features/pages/AgentPackagePage"

/** The document title of the packaging page. */
export { agentPackageMetadata as generateMetadata } from "@/features/pages/AgentPackagePage"

type PageProps = { readonly params: Promise<{ installation: string }> }

/** The packaging slot of one installed agent. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { installation } = await props.params
    return <AgentPackagePage installationId={installation} />
}

export default Page
