import { AdminRowsCard } from "@/components/composites/AdminRowsCard"
import type { AdminCardView } from "@/modules/types"
import { GRID_CLASS_NAME } from "./classNames"

/** The list cards the connected workspace lists supply. */
export interface AdminWorkspaceListsBaseProps {
    readonly props: {
        readonly cards: ReadonlyArray<AdminCardView>
    }
}

/** Draws the lists under the workspace overview: members, agents, connections, knowledge, orders, transfers and errors. */
export const AdminWorkspaceListsBase = (props: AdminWorkspaceListsBaseProps) => (
    <div className={GRID_CLASS_NAME}>
        {props.props.cards.map((card) => (
            <AdminRowsCard key={card.id} card={card} />
        ))}
    </div>
)
