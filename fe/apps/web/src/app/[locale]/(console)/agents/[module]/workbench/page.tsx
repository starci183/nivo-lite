import { AgentTypeRedirectPage } from "@/features/pages/AgentTypeRedirectPage"

type PageProps = {
    readonly params: Promise<{ module: string }>
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** The url of the workbench tab before agents became instances. */
const Page = async (props: PageProps) => (
    <AgentTypeRedirectPage module={(await props.params).module} tab="workbench" search={await props.searchParams} />
)

export default Page
