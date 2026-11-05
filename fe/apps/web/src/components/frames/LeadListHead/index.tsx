import { Button } from "@starci/grammar/common"
import { PaneHead } from "@/components/composites/PaneHead"

/** What the list head draws: its title, the add command, and whether a lead is open or the list is a first run. */
interface LeadListHeadProps {
    readonly title: string
    readonly newLead: string
    readonly isFirstRun: boolean
    readonly isLeadOpen: boolean
    readonly onNewLead: () => void
}

/** The list head: the title and the command that adds a lead. It is the page's one primary while nothing is open, quiet beside an open lead, and absent on a first run, whose notice holds it. */
export const LeadListHead = (props: LeadListHeadProps) => {
    if (props.isFirstRun) return <PaneHead title={props.title} />
    if (!props.isLeadOpen) {
        return (
            <PaneHead
                title={props.title}
                primary={{ label: props.newLead, onPress: props.onNewLead }}
                primaryOnPhone="head"
            />
        )
    }
    return (
        <PaneHead
            title={props.title}
            actions={
                <Button intent="neutral" size="sm" onPress={props.onNewLead}>
                    {props.newLead}
                </Button>
            }
        />
    )
}
