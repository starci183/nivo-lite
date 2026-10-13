import { AutomationsPage } from "@/features/pages/AutomationsPage"

export { automationsMetadata as generateMetadata } from "@/features/pages/AutomationsPage"

type PageProps = { searchParams: Promise<{ focus?: string }> }

/** Automations: ready-made jobs the owner switches on. Owner and manager only. `?focus=<key>` opens that card. */
const Page = async ({ searchParams }: PageProps) => <AutomationsPage focus={(await searchParams).focus} />

export default Page
