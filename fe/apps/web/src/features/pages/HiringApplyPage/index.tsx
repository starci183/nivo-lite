import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { HiringApplyPageBase } from "./component"

/** What the route passes through: the workspace segment (the public slug of the company the link names) and the job slug of the public link. */
interface HiringApplyPageProps {
    readonly params: Promise<{ readonly workspaceId: string; readonly job: string }>
}

/** The document title of the page. */
export const hiringApplyMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("hiring")
    return { title: t("applyPageTitle"), robots: { index: false, follow: false } }
}

/**
 * The public job page: the post, then the apply form. No login, no console chrome. The job is read in the browser from the
 * anonymous-callable `publicHiringJob` query.
 */
export const HiringApplyPage = async (props: HiringApplyPageProps): Promise<ReactElement> => {
    const { workspaceId, job } = await props.params
    return <HiringApplyPageBase props={{ ws: workspaceId, job }} />
}
