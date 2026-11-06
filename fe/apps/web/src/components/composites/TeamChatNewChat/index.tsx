import { Alert, Button, CheckboxGroup, Drawer, Input, Select, Stack, Text } from "@starci/grammar/common"
import { partyKeyOf } from "@/modules/teamChat"
import type { ChatParty } from "@/modules/teamChat"

/** The words of the new-chat drawer. */
export interface TeamChatNewChatCopy {
    readonly title: string
    readonly description: string
    readonly closeLabel: string
    readonly directTitle: string
    readonly directLabel: string
    readonly directPlaceholder: string
    readonly directStart: string
    readonly groupTitle: string
    readonly groupNameLabel: string
    readonly groupMembersLabel: string
    readonly groupCreate: string
    readonly kindPerson: string
    readonly kindAgent: string
    readonly empty: string
}

/** What the drawer draws and holds: the form values live in the block, so the drawer stays a picture of them. */
export interface TeamChatNewChatProps {
    readonly isOpen: boolean
    readonly copy: TeamChatNewChatCopy
    readonly people: ReadonlyArray<ChatParty>
    readonly agents: ReadonlyArray<ChatParty>
    /** The party picked for a direct room, as "kind:id", or null. */
    readonly direct: string | null
    readonly groupName: string
    /** The parties ticked for a group, as "kind:id". */
    readonly groupMembers: ReadonlyArray<string>
    readonly isPending: boolean
    readonly error: string | null
    readonly onOpenChange: (isOpen: boolean) => void
    readonly onDirect: (value: string | null) => void
    readonly onGroupName: (value: string) => void
    readonly onGroupMembers: (value: ReadonlyArray<string>) => void
    readonly onStartDirect: () => void
    readonly onCreateGroup: () => void
}

/** The new-chat drawer: a direct chat with one person or agent, or a group with a name and its members. */
export const TeamChatNewChat = (props: TeamChatNewChatProps) => {
    const { copy } = props
    const everyone = [...props.people, ...props.agents]
    const options = everyone.map((party) => ({
        id: partyKeyOf(party),
        label: party.name,
        description: party.kind === "agent" ? copy.kindAgent : copy.kindPerson,
    }))
    return (
        <Drawer
            isOpen={props.isOpen}
            onOpenChange={props.onOpenChange}
            title={copy.title}
            description={copy.description}
            closeLabel={copy.closeLabel}
            placement="right"
        >
            <Stack gap="section">
                {props.error === null ? null : <Alert tone="negative" title={props.error} />}
                {everyone.length === 0 ? (
                    <Text size="sm" tone="muted">
                        {copy.empty}
                    </Text>
                ) : (
                    <>
                        <Stack gap="row">
                            <Text size="sm" tone="muted">
                                {copy.directTitle}
                            </Text>
                            <Select
                                name="direct"
                                label={copy.directLabel}
                                placeholder={copy.directPlaceholder}
                                options={options}
                                value={props.direct}
                                onValueChange={props.onDirect}
                            />
                            <Button
                                intent="commit"
                                isDisabled={props.direct === null}
                                isPending={props.isPending}
                                onPress={props.onStartDirect}
                            >
                                {copy.directStart}
                            </Button>
                        </Stack>
                        <Stack gap="row">
                            <Text size="sm" tone="muted">
                                {copy.groupTitle}
                            </Text>
                            <Input
                                id="team-chat-group-name"
                                name="groupName"
                                label={copy.groupNameLabel}
                                value={props.groupName}
                                onValueChange={props.onGroupName}
                            />
                            <CheckboxGroup
                                name="groupMembers"
                                label={copy.groupMembersLabel}
                                options={options.map((option) => ({
                                    value: option.id,
                                    label: option.label,
                                    description: option.description,
                                }))}
                                value={props.groupMembers}
                                onValueChange={props.onGroupMembers}
                            />
                            <Button
                                intent="commit"
                                isDisabled={props.groupName.trim() === "" || props.groupMembers.length === 0}
                                isPending={props.isPending}
                                onPress={props.onCreateGroup}
                            >
                                {copy.groupCreate}
                            </Button>
                        </Stack>
                    </>
                )}
            </Stack>
        </Drawer>
    )
}
