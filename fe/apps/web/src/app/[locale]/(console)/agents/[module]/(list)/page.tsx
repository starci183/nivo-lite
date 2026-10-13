import { AgentTypePage, agentTypeMetadata } from "@/features/pages/AgentTypePage"

/** The document title of the list of the instances of a type. */
export const generateMetadata = async (props: PageProps) => agentTypeMetadata({ module: (await props.params).module })

type PageProps = {
    readonly params: Promise<{ module: string }>
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** The type slot of an agent. */
const Page = async (props: PageProps) => (
    <AgentTypePage module={(await props.params).module} search={await props.searchParams} />
)

export default Page
