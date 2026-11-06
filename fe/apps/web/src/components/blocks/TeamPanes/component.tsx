import { AlertDialog, Button, EmptyNotice, Page, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { PaneHead } from "@/components/composites/PaneHead"
import { TeamDetail } from "@/components/frames/TeamDetail"
import { TeamInviteDrawer } from "@/components/composites/TeamInviteDrawer"
import { TeamPeopleList } from "@/components/frames/TeamPeopleList"
import { PaneBody } from "@/components/frames/PaneBody"
import { Icon } from "@/components/leaves/Icon"
import type { TeamPanesBaseProps } from "@/modules/types"

/** Derived from the panes contract. */
type TeamPanesData = Extract<TeamPanesBaseProps["props"]["slot"], { readonly items: unknown }>["items"]

type Props = TeamPanesBaseProps

/** The ready shape while the team is read: five rows, one person, no words of data. */
const PLACEHOLDER: TeamPanesData = {
    rows: ["a", "b", "c", "d", "e"].map((id) => ({
        id: `member:${id}`,
        kind: "member" as const,
        title: " ",
        description: " ",
        isYou: false,
        badge: null,
    })),
    counts: { all: 0, members: 0, invites: 0 },
    members: [
        {
            id: "a",
            name: " ",
            email: " ",
            statusLabel: " ",
            isActive: true,
            isYou: false,
            role: "staff",
            roleOptions: [
                { value: "staff", label: " " },
                { value: "manager", label: " " },
            ],
            roleHint: " ",
            lastSignIn: " ",
            staffName: null,
            canChangeRole: true,
            canChangeAccess: true,
        },
    ],
    invites: [],
}

/** The list pane through the slot's one status recipe: skeleton, empty notice with its action, failure band with its retry. */
const ListPane = (props: Props) => (
    <SlotView
        slot={props.props.slot}
        placeholder={PLACEHOLDER}
        labels={props.props.labels}
        errorDescription={props.props.copy.errorBody}
        emptyDescription={props.props.copy.emptyBody}
        emptyAction={{ label: props.props.copy.inviteAction, onAction: props.on.openInvite }}
        onRetry={props.on.retry}
        render={(data, isSkeleton) => (
            <TeamPeopleList
                copy={props.props.copy}
                data={data}
                query={props.props.query}
                filter={props.props.filter}
                selectedId={props.props.selectedId}
                isLoading={isSkeleton}
                on={props.on}
            />
        )}
    />
)

/** The main pane: the opened record, the blank that asks for a choice, or the one notice staff see. */
const MainPane = (props: Props) => {
    const { copy } = props.props
    if (props.props.access === "staff") {
        return (
            <PaneSection align="center" grow>
                <EmptyNotice
                    message={copy.forbiddenTitle}
                    description={copy.forbiddenBody}
                    actionLabel={copy.forbiddenAction}
                    onAction={props.on.goOffice}
                />
            </PaneSection>
        )
    }
    if (props.props.selectedId === null) {
        return <PaneBlank message={copy.pickTitle} description={copy.pickBody} />
    }
    return (
        <PaneBody>
            <SlotView
                slot={props.props.slot}
                placeholder={PLACEHOLDER}
                labels={props.props.labels}
                onRetry={props.on.retry}
                render={(data, isSkeleton) => (
                    <TeamDetail
                        copy={copy}
                        data={data}
                        selectedId={props.props.selectedId}
                        isMemberPending={props.props.isMemberPending}
                        isLoading={isSkeleton}
                        on={props.on}
                    />
                )}
            />
        </PaneBody>
    )
}

/** The opened record's name: the person's or the invitation's address, empty while none is open or the team loads. */
const titleOf = (data: TeamPanesData | null, selectedId: string | null): string => {
    if (data === null || selectedId === null) return ""
    const member = data.members.find((entry) => `member:${entry.id}` === selectedId)
    return member?.name ?? data.invites.find((entry) => `invite:${entry.id}` === selectedId)?.email ?? ""
}

/** The head of the main pane: the opened record's name, with the way back on a phone. */
const MainHead = (props: Props) => {
    const data = "items" in props.props.slot ? props.props.slot.items : null
    const title = titleOf(data, props.props.selectedId)
    return (
        <PaneHead
            title={title === "" ? props.props.copy.detailLabel : title}
            headingLevel={2}
            isLoading={props.props.selectedId !== null && data === null}
            back={{ label: props.props.copy.back, onPress: props.on.back }}
        />
    )
}

/** The question the pane asks before it changes anything for good: a person's access or an invitation. */
const Confirmation = (props: Props) => {
    const confirm = props.props.confirm
    return (
        <AlertDialog
            isOpen={confirm !== undefined}
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.cancelConfirm()
            }}
            title={confirm?.title ?? ""}
            description={confirm?.description}
            tone="negative"
            confirmLabel={confirm?.confirmLabel ?? ""}
            cancelLabel={props.props.copy.cancelLabel}
            isConfirmPending={confirm?.isPending ?? false}
            onConfirm={props.on.acceptConfirm}
            onCancel={props.on.cancelConfirm}
        />
    )
}

/** The page header: the team's title and line, the Members / Permissions tabs and the one command that invites. */
const headerOf = (props: Props) => {
    const { copy } = props.props
    if (props.props.access !== "manager") return { title: copy.title, description: copy.description }
    return {
        title: copy.title,
        description: copy.description,
        actions: (
            <Button
                intent="commit"
                startContent={<Icon props={{ name: "add", usage: "leading" }} />}
                onPress={props.on.openInvite}
            >
                {copy.inviteAction}
            </Button>
        ),
        tabs: {
            label: copy.tabsLabel,
            selectedKey: "members",
            labelVisibility: "always" as const,
            items: [
                { id: "members", label: copy.membersTab, href: copy.membersHref },
                { id: "permissions", label: copy.permissionsTab, href: copy.permissionsHref },
            ],
        },
    }
}

/** Draws the team as the chat pattern: the people and invitations beside the opened one; a phone shows one pane with a way back. */
export const TeamPanesBase = (props: TeamPanesBaseProps) => {
    const { copy, grid } = props.props
    return (
        <Page chrome="panes" header={headerOf(props)}>
            <PaneGrid label={copy.grid} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
                {props.props.access === "manager" ? (
                    <Pane area="listHead" surface>
                        <PaneHead title={copy.listTitle} />
                    </Pane>
                ) : null}
                {props.props.access === "manager" ? (
                    <Pane area="list" surface scroll label={copy.listLabel}>
                        <PaneBody>
                            <ListPane {...props} />
                        </PaneBody>
                    </Pane>
                ) : null}
                <Pane area="head" surface>
                    <MainHead {...props} />
                    <Confirmation {...props} />
                    <TeamInviteDrawer
                        view={props.props.invite}
                        on={{
                            close: props.on.closeInvite,
                            setEmail: props.on.setInviteEmail,
                            setRole: props.on.setInviteRole,
                            setStaffId: props.on.setInviteStaff,
                            submit: props.on.submitInvite,
                            copied: props.on.inviteCopied,
                            goTeamPlan: props.on.goTeamPlan,
                        }}
                    />
                </Pane>
                <Pane area="main" scroll label={copy.detailLabel}>
                    <MainPane {...props} />
                </Pane>
            </PaneGrid>
        </Page>
    )
}
