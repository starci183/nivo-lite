import { Alert, Disclosure } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { SetupMeter } from "@/components/branches/SetupMeter"
import type { SetupSideView } from "@/modules/types"

/** View, the title of the checklist and the checklist itself. */
interface AgentSetupBandProps {
    readonly gates: SetupSideView["gates"]
    readonly checklistLabel: string
    readonly isSkeleton: boolean
    /** The items, the draft, the knowledge and the versions, drawn by the block. */
    readonly children: ReactNode
}

/**
 * What must be confirmed before the agent runs, above its map: the progress, the checklist of items with the draft, the knowledge and
 * the versions of the setup (open until the agent can run), and what the last run said. The run action is the one button over the map.
 */
export const AgentSetupBand = (props: AgentSetupBandProps) => {
    const { gates } = props
    return (
        <>
            <SetupMeter
                label={gates.title}
                valueLabel={gates.progressLabel}
                confirmed={gates.confirmed}
                total={gates.total}
                isSkeleton={props.isSkeleton}
            />
            <Disclosure title={props.checklistLabel} defaultExpanded={!gates.canApply}>
                {props.children}
            </Disclosure>
            {gates.applyTone === "idle" ? null : (
                <Alert title={gates.applyTitle} description={gates.applyText} tone="affirmative" />
            )}
        </>
    )
}
