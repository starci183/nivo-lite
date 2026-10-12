import { AutomationsPage } from "@/features/automations"

type PageProps = { searchParams: Promise<{ focus?: string }> }

/** Automations ("Tự động hoá"): ready-made jobs the owner switches on. Owner and manager only. `?focus=<key>` opens that card. */
const Page = async ({ searchParams }: PageProps) => <AutomationsPage focus={(await searchParams).focus} />

export default Page
