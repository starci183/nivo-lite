import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import type { ReactElement } from "react"
import { workbenchSpec } from "@/modules/workbench-spec"
import { SpecWorkbenchPageBase } from "./component"

/** The document title of the workbench. */
export const specWorkbenchMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_workbench") }
}

/** What the route hands the page: the module of the url and the view its path names. */
type SpecWorkbenchPageProps = {
    readonly module: string
    readonly view: string | null
}

/** The one workbench page of every module: the spec of the module (published, else seeded) drawn by the spec renderer. */
export const SpecWorkbenchPage = async (props: SpecWorkbenchPageProps): Promise<ReactElement> => {
    const resolved = workbenchSpec(props.module)
    if (resolved === null) notFound()
    const t = await getTranslations("modulesCore")
    return (
        <SpecWorkbenchPageBase
            props={{
                module: props.module,
                title: t("tab_workbench"),
                spec: resolved.spec,
                fallback: resolved.fallback,
                tab: props.view,
            }}
        />
    )
}
