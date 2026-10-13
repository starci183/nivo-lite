import { DecisionsPage } from "@/features/pages/DecisionsPage"

/** The document title of this page. */
export { decisionsPageMetadata as generateMetadata } from "@/features/pages/DecisionsPage"

interface PageProps {
    readonly searchParams: Promise<{ kind?: string | string[]; dept?: string | string[] }>
}

const firstOf = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? (value[0] ?? "") : (value ?? "")

/** The decisions route: `?kind=policy|human|rejected&dept=<module>` filter the history. */
const Page = async (props: PageProps) => {
    const query = await props.searchParams
    return <DecisionsPage kind={firstOf(query.kind)} department={firstOf(query.dept)} />
}

export default Page
