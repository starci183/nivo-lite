import { Alert, Button, CheckboxGroup, Drawer, Input, Select, Stack, Text } from "@starci/grammar/common"
import type { NewChatOption, TeamChatNewChatProps } from "@/modules/types"

/** What the direct chat form draws. */
interface DirectFormProps {
    readonly title: string
    readonly label: string
    readonly placeholder: string
    readonly start: string
    readonly options: ReadonlyArray<NewChatOption>
    readonly direct: string | null
    readonly isPending: boolean
    readonly onDirect: (value: string | null) => void
    readonly onStart: () => void
}

/** The direct chat: one person or agent to pick, and the command that starts it. */
const DirectForm = (props: DirectFormProps) => (
    <Stack gap="row">
        <Text size="sm" tone="muted">
            {props.title}
        </Text>
        <Select
            name="direct"
            label={props.label}
            placeholder={props.placeholder}
            options={props.options}
            value={props.direct}
            onValueChange={props.onDirect}
        />
        <Button intent="commit" isDisabled={props.direct === null} isPending={props.isPending} onPress={props.onStart}>
            {props.start}
        </Button>
    </Stack>
)

/** What the group form draws. */
interface GroupFormProps {
    readonly title: string
    readonly nameLabel: string
    readonly membersLabel: string
    readonly create: string
    readonly options: ReadonlyArray<NewChatOption>
    readonly name: string
    readonly members: ReadonlyArray<string>
    readonly isPending: boolean
    readonly onName: (value: string) => void
    readonly onMembers: (value: ReadonlyArray<string>) => void
    readonly onCreate: () => void
}

/** The group: its name, its members, and the command that creates it (an alternative to the direct chat, not the next step). */
const GroupForm = (props: GroupFormProps) => {
    const memberOptions = props.options.map((option) => ({
        value: option.id,
        label: option.label,
        description: option.description,
    }))
    return (
        <Stack gap="row">
            <Text size="sm" tone="muted">
                {props.title}
            </Text>
            <Input
                id="team-chat-group-name"
                name="groupName"
                label={props.nameLabel}
                value={props.name}
                onValueChange={props.onName}
            />
            <CheckboxGroup
                name="groupMembers"
                label={props.membersLabel}
                options={memberOptions}
                value={props.members}
                onValueChange={props.onMembers}
            />
            <Button
                intent="alternative"
                isDisabled={props.name.trim() === "" || props.members.length === 0}
                isPending={props.isPending}
                onPress={props.onCreate}
            >
                {props.create}
            </Button>
        </Stack>
    )
}

/** The new-chat drawer: a direct chat with one person or agent, or a group with a name and its members. */
export const TeamChatNewChat = (props: TeamChatNewChatProps) => (
    <Drawer
        isOpen={props.isOpen}
        onOpenChange={props.onOpenChange}
        title={props.copy.title}
        description={props.copy.description}
        closeLabel={props.copy.closeLabel}
        placement="right"
    >
        <Stack gap="section">
            {props.error === null ? null : <Alert tone="negative" title={props.error} />}
            {props.options.length === 0 ? (
                <Text size="sm" tone="muted">
                    {props.copy.empty}
                </Text>
            ) : (
                <>
                    <DirectForm
                        title={props.copy.directTitle}
                        label={props.copy.directLabel}
                        placeholder={props.copy.directPlaceholder}
                        start={props.copy.directStart}
                        options={props.options}
                        direct={props.direct}
                        isPending={props.isPending}
                        onDirect={props.onDirect}
                        onStart={props.onStartDirect}
                    />
                    <GroupForm
                        title={props.copy.groupTitle}
                        nameLabel={props.copy.groupNameLabel}
                        membersLabel={props.copy.groupMembersLabel}
                        create={props.copy.groupCreate}
                        options={props.options}
                        name={props.groupName}
                        members={props.groupMembers}
                        isPending={props.isPending}
                        onName={props.onGroupName}
                        onMembers={props.onGroupMembers}
                        onCreate={props.onCreateGroup}
                    />
                </>
            )}
        </Stack>
    </Drawer>
)
