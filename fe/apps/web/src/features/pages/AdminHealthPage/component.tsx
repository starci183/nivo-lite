import { SectionHeader } from "@starci/grammar/common"
import { AdminRowsCard } from "@/components/composites/AdminRowsCard"
import type { AdminCardView } from "@/hooks/admin"
import { GRID_CLASS_NAME } from "./classNames"

/** Copy and cards the platform health page supplies. */
export interface AdminHealthPageBaseProps {
    readonly props: {
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly cards: ReadonlyArray<AdminCardView>
    }
}

/** Draws the platform health page: sign-ups, billing, application errors and console activity as list cards. */
export const AdminHealthPageBase = (props: AdminHealthPageBaseProps) => (
    <>
        <SectionHeader
            level={1}
            eyebrow={props.props.eyebrow}
            title={props.props.title}
            description={props.props.description}
        />
        <div className={GRID_CLASS_NAME}>
            {props.props.cards.map((card) => (
                <AdminRowsCard key={card.id} card={card} />
            ))}
        </div>
    </>
)
