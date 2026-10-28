import { Avatar, Badge, type BadgeTone } from "@starci/grammar/common"

/** What the header says about one lead, already worded. */
export interface HeaderView {
    readonly name: string
    readonly meta: string
    readonly stageLabel: string
    readonly stageTone: BadgeTone
}

/** The slot of the page head this block fills. */
export type LeadHeaderPart = "mark" | "title" | "status" | "description"

/** One slot of the lead head, the lead it reads (none while it failed or is missing) and the title kept then. */
export interface LeadHeaderBaseProps {
    readonly props: {
        readonly part: LeadHeaderPart
        readonly view: HeaderView | undefined
        readonly isSkeleton: boolean
        readonly fallbackTitle: string
    }
}

const PLACEHOLDER: HeaderView = { name: "-", meta: "-", stageLabel: "-", stageTone: "neutral" }

/** One slot of the lead page head: the avatar, the name, the stage badge or the meta line. While the lead loads each slot is inert geometry; when it failed the title keeps the page name and the panels below say why. */
export const LeadHeaderBase = (props: LeadHeaderBaseProps) => {
    const { props: p } = props
    const view = p.isSkeleton ? PLACEHOLDER : p.view
    if (p.part === "title") return <>{p.isSkeleton ? PLACEHOLDER.name : (view?.name ?? p.fallbackTitle)}</>
    if (view === undefined) return null
    if (p.part === "mark") return <Avatar name={view.name} size="lg" isSkeleton={p.isSkeleton} />
    if (p.part === "status") {
        return (
            <Badge tone={view.stageTone} isDot isSkeleton={p.isSkeleton}>
                {view.stageLabel}
            </Badge>
        )
    }
    return <>{view.meta}</>
}
