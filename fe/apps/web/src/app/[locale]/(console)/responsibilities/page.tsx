import { ResponsibilitiesPage } from "@/features/pages/ResponsibilitiesPage"

/** The document title of this page. */
export { responsibilitiesPageMetadata as generateMetadata } from "@/features/pages/ResponsibilitiesPage"

interface PageProps {
    readonly searchParams: Promise<{ status?: string | string[]; due?: string | string[] }>
}

const firstOf = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? (value[0] ?? "") : (value ?? "")

/** The responsibilities route: `?status=open|waiting_approval|done&due=overdue|today|week|none` preselect the filters. */
const Page = async (props: PageProps) => {
    const query = await props.searchParams
    return <ResponsibilitiesPage status={firstOf(query.status)} due={firstOf(query.due)} />
}

export default Page
