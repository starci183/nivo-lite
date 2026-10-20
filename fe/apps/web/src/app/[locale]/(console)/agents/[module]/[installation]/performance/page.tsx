import { MarketingPerformancePage } from "@/features/pages/MarketingPerformancePage"

/** The document title of the performance tab. */
export { marketingPerformanceMetadata as generateMetadata } from "@/features/pages/MarketingPerformancePage"

type PageProps = { readonly params: Promise<{ module: string; installation: string }> }

/** The performance slot of one agent instance (the weekly report of the AI Marketing agent). */
const Page = async (props: PageProps) => {
    const { module } = await props.params
    return <MarketingPerformancePage module={module} />
}

export default Page
