import { notFound } from "next/navigation"
import type { ReactElement } from "react"
import { AuthorityPage } from "@/features/pages/AuthorityPage"
import { authoritySectionOf } from "@/modules/authority"

/** The document title of this page. */
export { authorityPageMetadata as generateMetadata } from "@/features/pages/AuthorityPage"

interface PageProps {
    readonly params: Promise<{ section: string }>
}

/** One section of the authority page ("Giao quyen"): goals, policies, automation scope, limits or staff; any other address is not found. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const section = authoritySectionOf((await props.params).section)
    if (section === null) notFound()
    return <AuthorityPage section={section} />
}

export default Page
