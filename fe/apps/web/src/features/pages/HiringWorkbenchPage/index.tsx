import { HiringWorkbench } from "@/components/blocks/HiringWorkbench"

/** What the agent workbench route hands the slot. */
interface HiringWorkbenchPageProps {
    /** `?tab=` from the route (jobs, candidates, interviews, offers, onboarding, settings); anything else opens the first tab. */
    readonly tab?: string | null
    /** `?focus=` from the route: the candidate, offer or interview a waiting row leads to. */
    readonly focus?: string | null
    /** The id of the installation the workbench is opened for, from the route. */
    readonly installationId?: string
}

/** The Hiring workbench slot: a thin server shell that mounts the connected client block. */
export const HiringWorkbenchPage = (props: HiringWorkbenchPageProps) => (
    <HiringWorkbench
        initialTab={props.tab ?? null}
        focus={props.focus ?? null}
        installationId={props.installationId ?? null}
    />
)
