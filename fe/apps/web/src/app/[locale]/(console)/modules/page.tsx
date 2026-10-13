import { ModulesRedirectPage } from "@/features/pages/ModulesRedirectPage"

export { agentIdRedirectMetadata as generateMetadata } from "@/features/pages/AgentIdRedirectPage"

/** Moved: the module catalogue is /agents. */
const Page = () => <ModulesRedirectPage />

export default Page
