import { ListBox } from "@starci/grammar/common"
import { ChatPartyMark } from "@/components/branches/ChatPartyMark"
import type { TeamChatMemberView } from "@/modules/types"

/** The members of a room and the name of the list. */
interface TeamChatMembersProps {
    readonly label: string
    readonly members: ReadonlyArray<TeamChatMemberView>
}

/** The members of the open room, each with the mark of the person or the agent and, muted, what it is. */
export const TeamChatMembers = (props: TeamChatMembersProps) => (
    <ListBox
        label={props.label}
        items={props.members.map((member) => ({
            id: member.key,
            label: member.party.name,
            description: member.description,
            leading: <ChatPartyMark mark={member.mark} />,
        }))}
    />
)
