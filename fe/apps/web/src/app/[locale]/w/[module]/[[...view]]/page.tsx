import type { ReactElement } from "react"
import { SpecWorkbenchPage } from "@/features/pages/SpecWorkbenchPage"

/** The document title of the workbench. */
export { specWorkbenchMetadata as generateMetadata } from "@/features/pages/SpecWorkbenchPage"

type PageProps = {
    readonly params: Promise<{ module: string; view?: string[] }>
    readonly searchParams: Promise<{ installation?: string | string[] }>
}

const first = (value: string | string[] | undefined): string | null =>
    (Array.isArray(value) ? (value[0] ?? null) : (value ?? null)) || null

/** The one workbench route: `/w/<module>` opens the first view, `/w/<module>/<view>` the view the path names. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const [{ module, view }, query] = await Promise.all([props.params, props.searchParams])
    return (
        <SpecWorkbenchPage module={module} view={view?.[0] ?? null} installationId={first(query.installation) ?? ""} />
    )
}

export default Page
