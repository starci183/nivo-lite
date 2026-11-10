import { GuideTarget } from "@/components/leaves/GuideTarget"
import { Button } from "@starci/grammar/common"

/** The words and the command of the create action. */
export interface AgentCreateActionBaseProps {
    readonly props: {
        /** "+ Create agent". */
        readonly label: string
        /** The person may install agents; staff, who get no install buttons, get no create action either. */
        readonly canCreate: boolean
    }
    readonly on: { readonly create: () => void }
}

/** Draws the create action of the catalogue header, or nothing for a person who may not install agents. */
export const AgentCreateActionBase = (props: AgentCreateActionBaseProps) =>
    props.props.canCreate ? (
        <GuideTarget id="agents.create">
            <Button intent="commit" startGlyph="plus" onPress={props.on.create}>
                {props.props.label}
            </Button>
        </GuideTarget>
    ) : null
