import { NewModuleRedirectPage } from "@/features/pages/NewModuleRedirectPage"

export { newModuleRedirectMetadata as generateMetadata } from "@/features/pages/NewModuleRedirectPage"

type PageProps = { readonly searchParams: Promise<{ module?: string }> }

/** The old "add a module" url: forwards to the agent type under /agents. */
const Page = async ({ searchParams }: PageProps) => <NewModuleRedirectPage module={(await searchParams).module} />

export default Page
