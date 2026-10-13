import { SectionHeader } from "@starci/grammar/common"
import { AdminRowsCard } from "@/components/composites/AdminRowsCard"
import type { AdminCardView } from "@/hooks/admin"
import { GRID_CLASS_NAME } from "./classNames"
import { AdminLoadState } from "@/components/composites/AdminLoadState"
import type { AdminLoad } from "@/components/composites/AdminLoadState"

/** Copy and cards the platform health page supplies. */
interface AdminHealthViewProps {
    readonly props: {
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly cards: ReadonlyArray<AdminCardView>
    }
}

/** Draws the platform health page: sign-ups, billing, application errors and console activity as list cards. */
const AdminHealthView = (props: AdminHealthViewProps) => (
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

/** The workspace read and, once it arrived, the view it draws. */
export interface AdminHealthBaseProps {
    readonly props: {
        readonly load: AdminLoad
        readonly view: AdminHealthViewProps["props"] | undefined
    }
}

/** Draws the loading state, the failure or the finished view of the connected read. */
export const AdminHealthBase = (props: AdminHealthBaseProps) => (
    <AdminLoadState {...props.props.load}>
        {props.props.view === undefined ? null : <AdminHealthView props={props.props.view} />}
    </AdminLoadState>
)
