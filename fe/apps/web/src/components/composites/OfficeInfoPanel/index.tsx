import { Button, IconButton, PaneSection, Region, SurfaceCard, Text } from "@starci/grammar/common"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { OfficeMemberRow } from "@/components/branches/OfficeMemberRow"
import { OfficeRoomResources } from "@/components/branches/OfficeRoomResources"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OfficeInfoPanelProps, OfficeJumpRowView, OfficeText, OfficeWaitingRowView } from "@/modules/types"
import {
    HEAD_CLASS_NAME,
    HEAD_TEXT_CLASS_NAME,
    JUMP_ROW_CLASS_NAME,
    SECTION_CLASS_NAME,
    TEXT_CLASS_NAME,
    TITLE_CLASS_NAME,
} from "./classNames"

type JumpRowProps<Row extends OfficeJumpRowView> = {
    readonly row: Row
    readonly jumpLabel: string
    readonly onJump: (row: Row) => void
}

/** One waiting thing as a compact card whose whole face jumps to it in the thread. */
const JumpRow = <Row extends OfficeJumpRowView>(props: JumpRowProps<Row>) => (
    <SurfaceCard
        wholeAction={{
            kind: "button",
            press: () => props.onJump(props.row),
            label: `${props.jumpLabel}: ${props.row.title}`,
        }}
    >
        <div className={JUMP_ROW_CLASS_NAME}>
            <OfficeAvatar avatar={props.row.avatar} size="xs" />
            <div className={TEXT_CLASS_NAME}>
                <Text size="sm" weight="medium" overflow="clamp-2">
                    {props.row.title}
                </Text>
                <Text size="xs" tone="muted" overflow="truncate">
                    {props.row.subtitle}
                </Text>
            </div>
        </div>
    </SurfaceCard>
)

type JumpListProps<Row extends OfficeJumpRowView> = {
    readonly title: string
    readonly none: string
    readonly jumpLabel: string
    readonly rows: ReadonlyArray<Row>
    readonly onJump: (row: Row) => void
}

/** A list of waiting things; each row jumps to its card in the thread. */
const JumpList = <Row extends OfficeJumpRowView>(props: JumpListProps<Row>) => (
    <Region label={props.title} className={SECTION_CLASS_NAME}>
        <div className={TITLE_CLASS_NAME}>
            <Text weight="semibold">{props.title}</Text>
            <Text size="sm" tone="muted">{`${props.rows.length}`}</Text>
        </div>
        {props.rows.length === 0 ? (
            <Text size="sm" tone="muted">
                {props.none}
            </Text>
        ) : (
            props.rows.map((row) => (
                <JumpRow key={row.id} row={row} jumpLabel={props.jumpLabel} onJump={props.onJump} />
            ))
        )}
    </Region>
)

/** What the info column head draws and asks. */
interface OfficeInfoHeadProps {
    readonly props: { readonly text: OfficeText }
    readonly on: { readonly close: () => void }
}

/** The head band of the docked info column, centred in the shared head row: its title and the close control. */
export const OfficeInfoHead = (props: OfficeInfoHeadProps) => {
    const { text } = props.props
    return (
        <PaneSection align="center">
            <div className={HEAD_CLASS_NAME}>
                <div className={HEAD_TEXT_CLASS_NAME}>
                    <Text weight="semibold">{text("infoTitle")}</Text>
                </div>
                <IconButton
                    intent="dismiss"
                    source={nivoIconSource("close", "leading")}
                    label={text("infoClose")}
                    onPress={props.on.close}
                />
            </div>
        </PaneSection>
    )
}

/** The right column body as one band of its pane (docked or in the drawer), its blocks a section step apart: what waits for approval, who is in the chat and the team's tasks. */
export const OfficeInfoPanel = (props: OfficeInfoPanelProps) => {
    const { info, text } = props.props
    return (
        <PaneSection gap="section">
            <JumpList
                title={text("pendingTitle")}
                none={text("pendingNone")}
                jumpLabel={text("pendingJump")}
                rows={info.approvals}
                onJump={(row: OfficeWaitingRowView) =>
                    row.target === "approval" ? props.on.jumpApproval(row.id) : props.on.jumpException(row.id)
                }
            />
            <JumpList
                title={text("exceptionsTitle")}
                none={text("exceptionsNone")}
                jumpLabel={text("exceptionJump")}
                rows={info.exceptions}
                onJump={(row) => props.on.jumpException(row.id)}
            />
            {renderOfficeInfoPanelMembers(text, info, props)}
            <OfficeRoomResources
                cards={info.cards}
                channels={info.channels}
                pins={info.pins}
                text={text}
                onJump={props.on.jumpCard}
            />
            <Region label={text("tasksTitle")} className={SECTION_CLASS_NAME}>
                <div className={TITLE_CLASS_NAME}>
                    <Text weight="semibold">{text("tasksTitle")}</Text>
                </div>
                <Text size="sm" tone="muted">
                    {info.tasksSummary}
                </Text>
                <Button intent="neutral" size="sm" width="fill" onPress={props.on.openTasks}>
                    {text("tasksOpen")}
                </Button>
            </Region>
        </PaneSection>
    )
}

/** Renders the OfficeInfoPanel members section. */
const renderOfficeInfoPanelMembers = (
    text: NonNullable<OfficeInfoPanelProps["props"]["text"]>,
    info: NonNullable<OfficeInfoPanelProps["props"]["info"]>,
    props: OfficeInfoPanelProps,
) => (
    <Region label={text("membersTitle")} className={SECTION_CLASS_NAME}>
        <div className={TITLE_CLASS_NAME}>
            <Text weight="semibold">{text("membersTitle")}</Text>
            <Text size="sm" tone="muted">{`${info.members.length}`}</Text>
        </div>
        {info.members.map((member) => (
            <OfficeMemberRow
                key={member.id}
                avatar={<OfficeAvatar avatar={member.avatar} />}
                member={member}
                youLabel={text("youTag")}
                mentionLabel={text("mention")}
                chatLabel={text("chat11")}
                onMention={props.on.mention}
            />
        ))}
        <Button intent="neutral" size="sm" width="fill" href={info.addAgentHref}>
            {text("addAgent")}
        </Button>
    </Region>
)
