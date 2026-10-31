import { Button } from "@starci/grammar/common"

/** The words and destination of the create action. */
export interface AgentCreateActionBaseProps {
    readonly props: {
        /** "+ Create agent". */
        readonly label: string
        /** The roles to add. */
        readonly href: string
        /** The person may install agents; staff, who get no install buttons, get no create action either. */
        readonly canCreate: boolean
    }
}

/** Draws the create action of the catalogue header, or nothing for a person who may not install agents. */
export const AgentCreateActionBase = (props: AgentCreateActionBaseProps) =>
    props.props.canCreate ? (
        <Button intent="commit" href={props.props.href}>
            {props.props.label}
        </Button>
    ) : null
