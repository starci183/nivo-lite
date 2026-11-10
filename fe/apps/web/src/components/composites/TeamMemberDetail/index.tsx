import { Button, ChoiceChips, Cluster, SurfaceCard } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import type { TeamPanesBaseProps } from "@/modules/types"

/** Derived from the panes contract. */
type TeamPanesData = Extract<TeamPanesBaseProps["props"]["slot"], { readonly items: unknown }>["items"]
/** Derived from the panes contract. */
type TeamMemberDetailView = TeamPanesData["members"][number]
/** Derived from the panes contract. */
type TeamMemberDetailCopy = TeamPanesBaseProps["props"]["copy"]["member"]

/** What the opened person's pane draws and does. */
interface TeamMemberDetailProps {
    readonly view: TeamMemberDetailView
    readonly copy: TeamMemberDetailCopy
    readonly isPending: boolean
    readonly isLoading: boolean
    readonly onRole: (role: string) => void
    readonly onEnable: () => void
    readonly onDisable: () => void
    readonly onRemove: () => void
}

/** What the access commands need. */
interface AccessSectionProps {
    readonly copy: TeamMemberDetailCopy
    readonly isActive: boolean
    readonly isPending: boolean
    readonly isLoading: boolean
    readonly onEnable: () => void
    readonly onDisable: () => void
    readonly onRemove: () => void
}

/** The access commands of a person as one card: switch access off or on, and remove them; the consequence sits under the card. */
const AccessCard = (props: AccessSectionProps) => (
    <SurfaceCard
        label={props.copy.accessTitle}
        headingLevel={3}
        isLoading={props.isLoading}
        note={props.copy.accessHint}
    >
        <Cluster gap="inline">
            {props.isActive ? (
                <Button intent="alternative" isPending={props.isPending} onPress={props.onDisable}>
                    {props.copy.disableLabel}
                </Button>
            ) : (
                <Button intent="alternative" isPending={props.isPending} onPress={props.onEnable}>
                    {props.copy.enableLabel}
                </Button>
            )}
            <Button intent="destructive" step="entry" isPending={props.isPending} onPress={props.onRemove}>
                {props.copy.removeLabel}
            </Button>
        </Cluster>
    </SurfaceCard>
)

/** The person as rows of one list: who they are with their state, then the last sign-in and the staff row they are linked to. */
const rowsOf = (props: TeamMemberDetailProps): ReadonlyArray<ListRowData> => [
    {
        id: "person",
        title: props.view.name,
        description: props.view.email,
        leading: { avatar: { name: props.view.name } },
        badges: props.view.isYou
            ? ([
                  { label: props.view.statusLabel, tone: props.view.isActive ? "success" : "neutral" },
                  { label: props.copy.youLabel, tone: "neutral" },
              ] as const)
            : ([{ label: props.view.statusLabel, tone: props.view.isActive ? "success" : "neutral" }] as const),
    },
    { id: "lastSignIn", title: props.copy.lastSignInTerm, description: props.view.lastSignIn },
    ...(props.view.staffName === null
        ? []
        : [{ id: "staff", title: props.copy.staffTerm, description: props.view.staffName }]),
]

/**
 * The opened person as cards on the well: who they are with the facts, the role control with what the role may do, and the access
 * commands when the viewer may change them. Every card is geometry together while the team loads.
 */
export const TeamMemberDetail = (props: TeamMemberDetailProps) => (
    <>
        <SurfaceCard
            kind="list"
            ariaLabel={props.view.name}
            isLoading={props.isLoading}
            items={rowsOf(props)}
            empty={null}
        />
        <SurfaceCard
            label={props.copy.roleTitle}
            headingLevel={3}
            isLoading={props.isLoading}
            note={props.view.roleHint}
        >
            <ChoiceChips
                label={props.copy.roleLabel}
                isLabelHidden
                options={props.view.roleOptions.map((option) => ({
                    ...option,
                    isDisabled: !props.view.canChangeRole || props.isPending,
                }))}
                value={props.view.role}
                empty={props.copy.roleLabel}
                isLoading={props.isLoading}
                onValueChange={props.onRole}
            />
        </SurfaceCard>
        {props.view.canChangeAccess ? (
            <AccessCard
                copy={props.copy}
                isActive={props.view.isActive}
                isPending={props.isPending}
                isLoading={props.isLoading}
                onEnable={props.onEnable}
                onDisable={props.onDisable}
                onRemove={props.onRemove}
            />
        ) : null}
    </>
)
