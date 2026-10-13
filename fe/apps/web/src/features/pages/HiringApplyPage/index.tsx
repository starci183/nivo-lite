import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { HiringApplyPageBase } from "./component"

/** What the route passes through: the workspace slug and the job slug of the public link. */
interface HiringApplyPageProps {
    readonly params: Promise<{ readonly ws: string; readonly job: string }>
}

/** The document title of the page. */
export const hiringApplyMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("hiring")
    return { title: t("applyPageTitle") }
}

/**
 * The public job page: the post, then the apply form. No login, no console chrome. The job is read in the browser from the
 * anonymous-callable `publicHiringJob` query.
 */
export const HiringApplyPage = async (props: HiringApplyPageProps) => {
    const { ws, job } = await props.params
    const t = await getTranslations("hiring")
    return <HiringApplyPageBase props={{ ws, job, label: t("applyPageTitle") }} />
}
