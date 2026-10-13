import { HiringApplyPage } from "@/features/pages/HiringApplyPage"

export { hiringApplyMetadata as generateMetadata } from "@/features/pages/HiringApplyPage"

type PageProps = Parameters<typeof HiringApplyPage>[0]

/** Public job page: the post and the apply form. */
const Page = (props: PageProps) => <HiringApplyPage params={props.params} />

export default Page
