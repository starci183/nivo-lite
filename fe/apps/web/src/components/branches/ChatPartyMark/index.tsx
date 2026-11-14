import { IconTile } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { nivoIconSource } from "@/components/leaves/Icon"
import { NivoLogo } from "@/components/leaves/NivoLogo"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { TeamChatMarkView } from "@/modules/types"

/** Whom the mark names and how large it is. */
interface ChatPartyMarkProps {
    readonly mark: TeamChatMarkView
    readonly size?: "sm" | "md"
}

/** The height of NIVO's own mark at each avatar size, in pixels. */
const NIVO_MARK_HEIGHT = { sm: 32, md: 40 } as const

/** The mark of one side of a conversation: NIVO's own mark (the product logo), the avatar of a person, the picture of an agent (else Grammar's fallback mark), the group glyph of a group. */
export const ChatPartyMark = (props: ChatPartyMarkProps) => {
    const { mark } = props
    const size = props.size ?? "md"
    if (mark.kind === "nivo") return <NivoLogo variant="mark" label={mark.name} height={NIVO_MARK_HEIGHT[size]} />
    if (mark.kind === "group") return <IconTile source={nivoIconSource("community", "leading")} tone="neutral" />
    if (mark.kind === "agent") return <AgentMark label={mark.name} seed={mark.id} src={mark.picture} size={size} />
    return <PersonAvatar name={mark.name} seed={mark.id} size={size} />
}
