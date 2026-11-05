import type { ReactElement } from "react"
import { SpecWorkbenchPage } from "@/features/pages/SpecWorkbenchPage"

/** The document title of the workbench. */
export { specWorkbenchMetadata as generateMetadata } from "@/features/pages/SpecWorkbenchPage"

type PageProps = {
    readonly params: Promise<{ module: string; view?: string[] }>
}

/** The one workbench route: `/w/<module>` opens the first view, `/w/<module>/<view>` the view the path names, on the module's installation in the active workspace. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { module, view } = await props.params
    return <SpecWorkbenchPage module={module} view={view?.[0] ?? null} />
}

export default Page
