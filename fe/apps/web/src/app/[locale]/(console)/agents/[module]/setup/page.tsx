import { AgentTypeRedirectPage } from "@/features/pages/AgentTypeRedirectPage"

export { agentSetupMetadata as generateMetadata } from "@/features/pages/AgentSetupPage"

type PageProps = {
    readonly params: Promise<{ module: string }>
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** The url of the setup tab before agents became instances. */
const Page = async (props: PageProps) => (
    <AgentTypeRedirectPage module={(await props.params).module} tab="setup" search={await props.searchParams} />
)

export default Page
