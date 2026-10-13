import { AgentWorkbenchPage } from "@/features/pages/AgentWorkbenchPage"

/** The document title of the workbench tab. */
export { agentWorkbenchMetadata as generateMetadata } from "@/features/pages/AgentWorkbenchPage"

type PageProps = {
    readonly params: Promise<{ module: string; installation: string }>
    readonly searchParams: Promise<{ tab?: string | string[]; focus?: string | string[] }>
}

const first = (value: string | string[] | undefined): string | null =>
    (Array.isArray(value) ? (value[0] ?? null) : (value ?? null)) || null

/** The workbench slot of one agent instance; the tab and focus of the query are the deep link contract of the agent dashboard frame. */
const Page = async (props: PageProps) => {
    const [{ module, installation }, query] = await Promise.all([props.params, props.searchParams])
    return (
        <AgentWorkbenchPage
            module={module}
            installationId={installation}
            tab={first(query.tab)}
            focus={first(query.focus)}
        />
    )
}

export default Page
