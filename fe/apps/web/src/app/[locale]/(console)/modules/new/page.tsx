import { ModulesRedirectPage } from "@/features/pages/ModulesRedirectPage"

export { agentIdRedirectMetadata as generateMetadata } from "@/features/pages/AgentIdRedirectPage"

/** What the route passes through: the module the old install link named. */
interface PageProps {
    readonly searchParams: Promise<{ readonly module?: string }>
}

/** Moved: installing a module is the Install button of /agents. */
const Page = async (props: PageProps) => <ModulesRedirectPage module={(await props.searchParams).module} />

export default Page
