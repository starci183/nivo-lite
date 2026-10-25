import { Button, Divider, IconButton, Region, SurfaceCard, Text } from "@starci/grammar/common"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { OfficeMemberRow } from "@/components/branches/OfficeMemberRow"
import { OfficeRoomResources } from "@/components/branches/OfficeRoomResources"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OfficeInfoPanelProps, OfficeJumpRowView } from "@/modules/types"
import {
    BODY_CLASS_NAME,
    DRAWER_BODY_CLASS_NAME,
    HEAD_CLASS_NAME,
    HEAD_TEXT_CLASS_NAME,
    JUMP_ROW_CLASS_NAME,
    SECTION_CLASS_NAME,
    TEXT_CLASS_NAME,
    TITLE_CLASS_NAME,
} from "./classNames"

type JumpRowProps = {
    readonly row: OfficeJumpRowView
    readonly jumpLabel: string
    readonly onJump: (id: string) => void
}

/** One waiting thing as a compact card whose whole face jumps to it in the thread. */
const JumpRow = (props: JumpRowProps) => (
    <SurfaceCard
        depth="nested"
        wholeAction={{
            kind: "button",
            press: () => props.onJump(props.row.id),
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

type JumpListProps = {
    readonly title: string
    readonly none: string
    readonly jumpLabel: string
    readonly rows: ReadonlyArray<OfficeJumpRowView>
    readonly onJump: (id: string) => void
}

/** A list of waiting things; each row jumps to its card in the thread. */
const JumpList = (props: JumpListProps) => (
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

/** The right column: what waits for approval, who is in the chat and the team's tasks. */
export const OfficeInfoPanel = (props: OfficeInfoPanelProps) => {
    const { info, isDocked, text } = props.props
    return (
        <>
            {isDocked ? (
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
            ) : null}
            {isDocked ? <Divider semantics="presentation" /> : null}
            <div className={isDocked ? BODY_CLASS_NAME : DRAWER_BODY_CLASS_NAME}>
                <JumpList
                    title={text("pendingTitle")}
                    none={text("pendingNone")}
                    jumpLabel={text("pendingJump")}
                    rows={info.approvals}
                    onJump={props.on.jumpApproval}
                />
                <JumpList
                    title={text("exceptionsTitle")}
                    none={text("exceptionsNone")}
                    jumpLabel={text("exceptionJump")}
                    rows={info.exceptions}
                    onJump={props.on.jumpException}
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
                    <Button intent="alternative" size="sm" width="fill" onPress={props.on.openTasks}>
                        {text("tasksOpen")}
                    </Button>
                </Region>
            </div>
        </>
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
        <Button intent="alternative" size="sm" width="fill" href={info.addAgentHref}>
            {text("addAgent")}
        </Button>
    </Region>
)
