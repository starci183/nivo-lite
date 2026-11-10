import { Alert } from "@starci/grammar/common"
import type { SetupSideView } from "@/modules/types"

/** The read of the side and the command that opens the page where a missing requirement is met. */
interface AgentSetupNoticesProps {
    readonly view: SetupSideView
    readonly onOpen: (href: string) => void
}

/** The notices above the cards: the requirements the workspace does not meet yet, and what the last apply said. */
export const AgentSetupNotices = (props: AgentSetupNoticesProps) => {
    const { view } = props
    return (
        <>
            {view.unmet === null ? null : (
                <Alert
                    title={view.unmet.title}
                    description={view.unmet.body}
                    tone="cautionary"
                    action={{ label: view.unmet.actionLabel, onAction: () => props.onOpen(view.unmet?.href ?? "") }}
                />
            )}
            {view.gates.applyTone === "idle" ? null : (
                <Alert title={view.gates.applyTitle} description={view.gates.applyText} tone="affirmative" />
            )}
        </>
    )
}
