import { Badge, Button, ChoiceChips, Cluster, DescriptionList, Section, Stack, Text } from "@starci/grammar/common"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
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

/** The access commands of a person: switch access off or on, and remove them from the workspace. */
const AccessSection = (props: AccessSectionProps) => (
    <Section title={props.copy.accessTitle} headingLevel={3} isLoading={props.isLoading}>
        <Stack gap="row">
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
            <Text size="sm" tone="muted">
                {props.copy.accessHint}
            </Text>
        </Stack>
    </Section>
)

/** The facts of a person that are not their role: the last sign-in and the staff row they are linked to. */
const factsOf = (props: TeamMemberDetailProps) => [
    { id: "lastSignIn", term: props.copy.lastSignInTerm, description: props.view.lastSignIn },
    ...(props.view.staffName === null
        ? []
        : [{ id: "staff", term: props.copy.staffTerm, description: props.view.staffName }]),
]

/**
 * The opened person: identity with the status, the role control with what the role may do, the facts, and the access commands
 * when the viewer may change them. Every part is geometry together while the team loads.
 */
export const TeamMemberDetail = (props: TeamMemberDetailProps) => (
    <>
        <Cluster gap="section" align="center">
            <PersonAvatar name={props.view.name} size="lg" isLoading={props.isLoading} />
            <Stack gap="identity">
                <Text isStrong isLoading={props.isLoading}>
                    {props.view.name}
                </Text>
                <Text size="sm" tone="muted" isLoading={props.isLoading}>
                    {props.view.email}
                </Text>
                <Cluster gap="inline">
                    <Badge tone={props.view.isActive ? "success" : "neutral"} isLoading={props.isLoading}>
                        {props.view.statusLabel}
                    </Badge>
                    {props.view.isYou ? <Badge tone="neutral">{props.copy.youLabel}</Badge> : null}
                </Cluster>
            </Stack>
        </Cluster>
        <Section title={props.copy.roleTitle} headingLevel={3} isLoading={props.isLoading}>
            <Stack gap="row">
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
                <Text size="sm" tone="muted" isLoading={props.isLoading}>
                    {props.view.roleHint}
                </Text>
            </Stack>
        </Section>
        <DescriptionList items={factsOf(props)} isLoading={props.isLoading} />
        {props.view.canChangeAccess ? (
            <AccessSection
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
