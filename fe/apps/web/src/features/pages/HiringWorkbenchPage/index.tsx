import { getTranslations } from "next-intl/server"
import { HiringWorkbenchPageBase } from "./component"

/** What the agent workbench route hands the slot. */
interface HiringWorkbenchPageProps {
    /** `?tab=` from the route (jobs, candidates, interviews, offers, onboarding, settings); anything else opens the first tab. */
    readonly tab?: string | null
    /** `?focus=` from the route: the candidate, offer or interview a waiting row leads to. */
    readonly focus?: string | null
    /** The id of the installation the workbench is opened for, from the route. */
    readonly installationId?: string
}

/** The Hiring workbench slot: a server shell that hands the route ids and the words to the page, whose blocks read their own data. */
export const HiringWorkbenchPage = async (props: HiringWorkbenchPageProps) => {
    const t = await getTranslations("workbenchFigures")
    return (
        <HiringWorkbenchPageBase
            props={{
                installationId: props.installationId ?? null,
                tab: props.tab ?? null,
                focus: props.focus ?? null,
                labels: {
                    roles: t("hrRoles"),
                    pipeline: t("hrPipeline"),
                    interviews: t("hrInterviews"),
                    offers: t("hrOffers"),
                    jobs: t("hrTabJobs"),
                    candidates: t("hrTabCandidates"),
                    interviewsTab: t("hrTabInterviews"),
                    offersTab: t("hrTabOffers"),
                    onboarding: t("hrTabOnboarding"),
                    settings: t("hrTabSettings"),
                },
            }}
        />
    )
}
