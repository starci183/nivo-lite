import { IconTile } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { TeamChatMarkView } from "@/modules/types"

/** Whom the mark names and how large it is. */
interface ChatPartyMarkProps {
    readonly mark: TeamChatMarkView
    readonly size?: "sm" | "md"
}

/** The mark of one side of a conversation: the avatar of a person, the picture of an agent (else Grammar's fallback mark), the group glyph of a group. */
export const ChatPartyMark = (props: ChatPartyMarkProps) => {
    const { mark } = props
    const size = props.size ?? "md"
    if (mark.kind === "group") return <IconTile source={nivoIconSource("community", "leading")} tone="neutral" />
    if (mark.kind === "agent") return <AgentMark label={mark.name} seed={mark.id} src={mark.picture} size={size} />
    return <PersonAvatar name={mark.name} seed={mark.id} size={size} />
}
