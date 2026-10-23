import type { useTranslations, useFormatter } from "next-intl"
import type { useMember } from "@/hooks/member"
import type { useTeam, useMemberCommands } from "@/hooks/team"
import { AlertDialog, Badge, Button, DataTable, DropdownMenu, Text } from "@starci/grammar/common"
import type { DataTableColumn, DataTableRow, DropdownMenuEntry } from "@starci/grammar/common"
import { TeamSection } from "@/components/composites/TeamSection"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import { IDENTITY_CLASS_NAME, IDENTITY_TEXT_CLASS_NAME, NAME_LINE_CLASS_NAME } from "./classNames"

/** One member, already worded for the person's language. */
export interface MemberRowView extends DataTableRow {
    readonly name: string
    readonly email: string
    readonly isYou: boolean
    readonly staffNote?: string | undefined
    readonly roleLabel: string
    readonly isActive: boolean
    readonly lastSignIn: string
    readonly menuLabel: string
    /** The actions the person may take on this member; none draws no menu. */
    readonly entries: ReadonlyArray<DropdownMenuEntry>
}

/** The question asked before a remove or a disable. */
interface ConfirmView {
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
}

/** Copy, rows and state the connected members table supplies. */
export interface TeamMembersBaseProps {
    readonly props: {
        readonly title: string
        readonly description?: string | undefined
        readonly failTitle: string
        readonly youLabel: string
        readonly activeLabel: string
        readonly disabledLabel: string
        readonly actionsLabel: string
        readonly cancelLabel: string
        readonly columns: ReadonlyArray<DataTableColumn>
        readonly rows: ReadonlyArray<MemberRowView>
        /** The members are loading: the heading and the column headers stay, the body is skeleton rows. */
        readonly isSkeleton: boolean
        readonly isPending: boolean
        readonly error?: string
        readonly confirm?: ConfirmView | undefined
    }
    readonly on: {
        readonly cancelConfirm: () => void
        readonly confirm: () => void
    }
}

/** Draws the members of the workspace as a table: who they are, role, status, last sign-in and the actions menu. */
export const TeamMembersBase = (props: TeamMembersBaseProps) => {
    const renderCell = (row: MemberRowView, columnId: string) => {
        if (columnId === "member") {
            return (
                <div className={IDENTITY_CLASS_NAME}>
                    <PersonAvatar name={row.name} size="md" />
                    <div className={IDENTITY_TEXT_CLASS_NAME}>
                        <div className={NAME_LINE_CLASS_NAME}>
                            <Text weight="semibold" overflow="truncate">
                                {row.name}
                            </Text>
                            {row.isYou ? <Badge tone="neutral">{props.props.youLabel}</Badge> : null}
                        </div>
                        <Text size="sm" tone="muted" overflow="truncate">
                            {row.email}
                        </Text>
                        {row.staffNote === undefined ? null : (
                            <Text size="xs" tone="muted" overflow="truncate">
                                {row.staffNote}
                            </Text>
                        )}
                    </div>
                </div>
            )
        }
        if (columnId === "role") {
            return (
                <Text size="sm" weight="medium">
                    {row.roleLabel}
                </Text>
            )
        }
        if (columnId === "status") {
            return (
                <Badge tone={row.isActive ? "success" : "neutral"}>
                    {row.isActive ? props.props.activeLabel : props.props.disabledLabel}
                </Badge>
            )
        }
        if (columnId === "lastSignIn") return <Text size="sm">{row.lastSignIn}</Text>
        if (row.entries.length === 0) return null
        return (
            <DropdownMenu
                placement="bottom end"
                entries={row.entries}
                trigger={
                    <Button variant="outline" isPending={props.props.isPending} aria-label={row.menuLabel}>
                        {props.props.actionsLabel}
                    </Button>
                }
            />
        )
    }
    return renderMembersSection({ props, renderCell })
}

const renderMembersSection = ({ props, renderCell }: RenderMembersSectionInput) => (
    <TeamSection
        id="team-members-title"
        title={props.props.title}
        description={props.props.description}
        failTitle={props.props.failTitle}
        error={props.props.error}
    >
        <DataTable
            label={props.props.title}
            columns={props.props.columns}
            rows={props.props.rows}
            renderCell={renderCell}
            isLoading={props.props.isSkeleton}
            emptyContent={null}
        />
        <AlertDialog
            isOpen={props.props.confirm !== undefined}
            onOpenChange={(open) => {
                if (!open) props.on.cancelConfirm()
            }}
            title={props.props.confirm?.title ?? ""}
            description={props.props.confirm?.description}
            tone="negative"
            confirmLabel={props.props.confirm?.confirmLabel ?? ""}
            cancelLabel={props.props.cancelLabel}
            isConfirmPending={props.props.isPending}
            onConfirm={props.on.confirm}
            onCancel={props.on.cancelConfirm}
        />
    </TeamSection>
)

type RenderMembersSectionInput = {
    props: TeamMembersBaseProps
    renderCell: (row: MemberRowView, columnId: string) => React.ReactNode
}
/** State values and commands consumed by the connected surface. */
export interface Asking {
    readonly userId: string
    readonly kind: "remove" | "disable"
}

/** State values and commands consumed by the connected surface. */
export type TeamMembersControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"team">>
    readonly format: ReturnType<typeof useFormatter>
    readonly member: ReturnType<typeof useMember>
    readonly selfRole: NonNullable<NonNullable<ReturnType<typeof useMember>>["role"]>
    readonly selfId: NonNullable<NonNullable<ReturnType<typeof useMember>>["userId"]>
    readonly isAllowed: boolean
    readonly views: ReturnType<typeof useTeam>["views"]
    readonly isLoading: ReturnType<typeof useTeam>["isLoading"]
    readonly commands: ReturnType<typeof useMemberCommands>
    readonly asking: Asking | undefined
    readonly setAsking: React.Dispatch<React.SetStateAction<Asking | undefined>>
}
