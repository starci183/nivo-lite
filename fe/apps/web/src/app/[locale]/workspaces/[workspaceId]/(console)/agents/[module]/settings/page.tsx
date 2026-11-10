import type { ReactElement } from "react"
import { AgentTypeRedirectPage } from "@/features/pages/AgentTypeRedirectPage"

export { agentSetupMetadata as generateMetadata } from "@/features/pages/AgentSetupPage"

type PageProps = {
    readonly params: Promise<{ module: string }>
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** The url of the settings tab before agents became instances: settings now live in Setup. */
const Page = async (props: PageProps): Promise<ReactElement> => (
    <AgentTypeRedirectPage module={(await props.params).module} tab="setup" search={await props.searchParams} />
)

export default Page
