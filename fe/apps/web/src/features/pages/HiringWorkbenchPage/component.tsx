import { HiringWorkbench } from "@/components/blocks/HiringWorkbench"

/** The existing server-resolved Hiring strip labels. */
interface HiringWorkbenchLabels {
    readonly jobs: string
    readonly candidates: string
    readonly interviewsTab: string
    readonly offersTab: string
    readonly onboarding: string
    readonly settings: string
}
/** Route identity and words only; the module block owns its reads and controllers. */
export interface HiringWorkbenchPageBaseProps {
    readonly props: {
        readonly installationId: string | null
        readonly tab: string | null
        readonly focus: string | null
        readonly labels: HiringWorkbenchLabels
    }
}

/** Composes the one Hiring world instead of passing connected panels through another block. */
export const HiringWorkbenchPageBase = (props: HiringWorkbenchPageBaseProps) => {
    const { installationId, tab, focus, labels } = props.props
    return (
        <HiringWorkbench
            installationId={installationId}
            initialTab={tab}
            focus={focus}
            tabs={{
                jobs: labels.jobs,
                candidates: labels.candidates,
                interviews: labels.interviewsTab,
                offers: labels.offersTab,
                onboarding: labels.onboarding,
                settings: labels.settings,
            }}
        />
    )
}
