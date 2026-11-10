import { Avatar, IconTile } from "@starci/grammar/common"
import type { IconTileTone } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { IconName } from "@/components/leaves/Icon"

/** The glyph and the soft colour of each kind of agent: the mark it wears on every screen. */
const KIND_MARK: Readonly<Record<string, { readonly glyph: IconName; readonly tone: IconTileTone }>> = {
    chatbot: { glyph: "moduleChatbot", tone: "accent" },
    lead_gen: { glyph: "moduleLeadGen", tone: "danger" },
    sales: { glyph: "moduleSales", tone: "danger" },
    accounting: { glyph: "moduleAccounting", tone: "warning" },
    shifts: { glyph: "moduleShifts", tone: "neutral" },
    booking: { glyph: "moduleBooking", tone: "accent" },
    inventory: { glyph: "moduleInventory", tone: "neutral" },
    loyalty: { glyph: "moduleLoyalty", tone: "warning" },
    video: { glyph: "moduleVideo", tone: "accent" },
    content: { glyph: "moduleContent", tone: "success" },
    hiring: { glyph: "moduleHiring", tone: "success" },
}

/** The kinds that have a 3D emblem under `public/agents/<key>.webp`; a kind outside it keeps its glyph. */
const EMBLEM_KINDS: ReadonlySet<string> = new Set([
    "chatbot",
    "lead_gen",
    "sales",
    "accounting",
    "shifts",
    "booking",
    "inventory",
    "loyalty",
    "video",
    "content",
    "hiring",
])

/** What the mark draws: the key of the agent kind and whether the agent is still being read. */
type AgentKindMarkProps = {
    readonly module: string
    readonly isLoading?: boolean | undefined
}

/** The mark of an agent kind: its 3D emblem, else the glyph of its type on the soft colour of its kind; an unknown kind wears the chatbot mark. The NIVO mascot is for NIVO itself. */
export const AgentKindMark = (props: AgentKindMarkProps) => {
    const mark = KIND_MARK[props.module] ?? KIND_MARK["chatbot"]
    const kind = KIND_MARK[props.module] === undefined ? "chatbot" : props.module
    if (EMBLEM_KINDS.has(kind)) {
        return <Avatar name={kind} src={`/agents/${kind}.webp`} shape="square" size="md" isDecorative isLoading={props.isLoading === true} />
    }
    return (
        <IconTile
            source={nivoIconSource(mark?.glyph ?? "moduleChatbot", "leading")}
            tone={mark?.tone ?? "accent"}
            size="md"
            isLoading={props.isLoading === true}
        />
    )
}
