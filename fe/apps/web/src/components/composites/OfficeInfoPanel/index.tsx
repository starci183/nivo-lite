import {
    Button,
    Cluster,
    EmptyNotice,
    Heading,
    IconButton,
    PaneSection,
    Stack,
    Section,
    Text,
} from "@starci/grammar/common"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { OfficeMemberRow } from "@/components/branches/OfficeMemberRow"
import { OfficeRoomResources } from "@/components/branches/OfficeRoomResources"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OfficeAvatarView, OfficeInfoPanelProps, OfficeJumpRowView, OfficeWaitingRowView } from "@/modules/types"
import { HEAD_TEXT_CLASS_NAME } from "./classNames"
import type { AvatarData } from "@starci/grammar/common"

/** The same person/agent identity passed to the collection's native leading slot. */
const avatarDataOf = (avatar: OfficeAvatarView): AvatarData => ({
    name: avatar.kind === "agent" ? avatar.label : avatar.name,
    ...(avatar.kind === "agent" ? { seed: avatar.seed, kind: "agent" as const } : {}),
    ...(avatar.src === null || avatar.src === undefined ? {} : { src: avatar.src }),
})

type JumpListProps<Row extends OfficeJumpRowView> = {
    readonly title: string
    readonly none: string
    readonly jumpLabel: string
    readonly rows: ReadonlyArray<Row>
    readonly onJump: (row: Row) => void
}

/** Waiting things share one collection; the destination remains an explicit row command. */
const JumpList = <Row extends OfficeJumpRowView>(props: JumpListProps<Row>) => (
    <Section
        kind="list"
        title={props.title}
        count={props.rows.length}
        items={props.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.subtitle,
            leading: { avatar: avatarDataOf(row.avatar) },
            action: { label: props.jumpLabel, press: () => props.onJump(row) },
        }))}
        empty={<EmptyNotice message={props.none} />}
    />
)

/** What the info column head draws and asks. */
interface OfficeInfoHeadProps {
    readonly props: { readonly title: string; readonly closeLabel: string }
    readonly on: { readonly close: () => void }
}

/** The head band of the docked info column, centred in the shared head row: its title and the close control. */
export const OfficeInfoHead = (props: OfficeInfoHeadProps) => {
    const { title, closeLabel } = props.props
    return (
        <PaneSection align="center">
            <Cluster gap="row" wrap={false}>
                <div className={HEAD_TEXT_CLASS_NAME}>
                    <Heading level={2}>{title}</Heading>
                </div>
                <IconButton
                    intent="dismiss"
                    source={nivoIconSource("close", "leading")}
                    label={closeLabel}
                    onPress={props.on.close}
                />
            </Cluster>
        </PaneSection>
    )
}

/** The right column body as one band of its pane (docked or in the drawer), its blocks a section step apart: what waits for approval, who is in the chat and the team's tasks. */
export const OfficeInfoPanel = (props: OfficeInfoPanelProps) => {
    const { info, copy } = props.props
    return (
        <PaneSection gap="section">
            <JumpList
                title={copy.pendingTitle}
                none={copy.pendingNone}
                jumpLabel={copy.pendingJump}
                rows={info.approvals}
                onJump={(row: OfficeWaitingRowView) =>
                    row.target === "approval" ? props.on.jumpApproval(row.id) : props.on.jumpException(row.id)
                }
            />
            <JumpList
                title={copy.exceptionsTitle}
                none={copy.exceptionsNone}
                jumpLabel={copy.exceptionJump}
                rows={info.exceptions}
                onJump={(row) => props.on.jumpException(row.id)}
            />
            {renderOfficeInfoPanelMembers(copy, info, props)}
            <OfficeRoomResources
                cards={info.cards}
                channels={info.channels}
                pins={info.pins}
                copy={copy}
                onJump={props.on.jumpCard}
            />
            <Section title={copy.tasksTitle}>
                <Stack gap="inline">
                    <Text size="sm" tone="muted">
                        {info.tasksSummary}
                    </Text>
                    <Button intent="neutral" size="sm" width="fill" onPress={props.on.openTasks}>
                        {copy.tasksOpen}
                    </Button>
                </Stack>
            </Section>
        </PaneSection>
    )
}

/** Renders the OfficeInfoPanel members section. */
const renderOfficeInfoPanelMembers = (
    copy: OfficeInfoPanelProps["props"]["copy"],
    info: NonNullable<OfficeInfoPanelProps["props"]["info"]>,
    props: OfficeInfoPanelProps,
) => (
    <Section title={copy.membersTitle} count={info.members.length}>
        <Stack gap="inline">
            {info.members.map((member) => (
                <OfficeMemberRow
                    key={member.id}
                    avatar={<OfficeAvatar avatar={member.avatar} />}
                    member={member}
                    youLabel={copy.youTag}
                    mentionLabel={copy.mention}
                    chatLabel={copy.chat11}
                    onMention={props.on.mention}
                />
            ))}
            <Button intent="neutral" size="sm" width="fill" href={info.addAgentHref}>
                {copy.addAgent}
            </Button>
        </Stack>
    </Section>
)
