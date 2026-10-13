import { LeadsPage } from "@/features/pages/LeadsPage"

/** The document title of this page. */
export { leadsPageMetadata as generateMetadata } from "@/features/pages/LeadsPage"

interface PageProps {
    readonly searchParams: Promise<{ q?: string | string[]; new?: string | string[] }>
}

const firstOf = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? (value[0] ?? "") : (value ?? "")

/** The leads route: mounts the page with the query it was opened with. */
const Page = async (props: PageProps) => {
    const query = await props.searchParams
    return <LeadsPage query={firstOf(query.q)} openForm={firstOf(query.new) === "1"} />
}

export default Page
