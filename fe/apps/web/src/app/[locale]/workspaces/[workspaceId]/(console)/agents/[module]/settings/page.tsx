import type { ReactElement } from "react"
import { AgentTypeRedirectPage } from "@/features/pages/AgentTypeRedirectPage"

export { agentSettingsMetadata as generateMetadata } from "@/features/pages/AgentSettingsPage"

type PageProps = {
    readonly params: Promise<{ module: string }>
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** The url of the settings tab before agents became instances. */
const Page = async (props: PageProps): Promise<ReactElement> => (
    <AgentTypeRedirectPage module={(await props.params).module} tab="settings" search={await props.searchParams} />
)

export default Page
