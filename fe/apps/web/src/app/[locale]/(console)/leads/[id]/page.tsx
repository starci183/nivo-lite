import { LeadPage } from "@/features/pages/LeadPage"

/** The document title of this page. */
export { leadPageMetadata as generateMetadata } from "@/features/pages/LeadPage"

interface PageProps {
    readonly params: Promise<{ id: string }>
}

/** OpenClaw writes the text (setup chat, Office replies, classification), so this screen may wait longer than the platform default. */
export const maxDuration = 60

/** The lead route: mounts the page for the lead the address names. */
const Page = async (props: PageProps) => {
    const { id } = await props.params
    return <LeadPage leadId={id} />
}

export default Page
