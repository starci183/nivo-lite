import {
    ChoiceChips,
    Alert,
    Button,
    Drawer,
    EmptyNotice,
    Form,
    Input,
    Select,
    Stack,
    Text,
} from "@starci/grammar/common"
import { InviteLink } from "@/components/branches/InviteLink"
import type { TeamPanesBaseProps } from "@/modules/types"
import { nivoIconSource } from "@/components/leaves/Icon"

/** Derived from the panes contract. */
type TeamInviteDrawerView = TeamPanesBaseProps["props"]["invite"]
/** Derived from the panes contract. */
type TeamInviteSentView = NonNullable<TeamInviteDrawerView["sent"]>

/** What the invite drawer does. */
interface TeamInviteDrawerProps {
    readonly view: TeamInviteDrawerView
    readonly on: {
        readonly close: () => void
        readonly setEmail: (value: string) => void
        readonly setRole: (value: string) => void
        readonly setStaffId: (value: string | null) => void
        readonly submit: () => void
        readonly copied: () => void
        readonly goTeamPlan: () => void
    }
}

/** The form: the address, the role, the staff row the person is, with the failure in place. */
const InviteForm = (props: TeamInviteDrawerProps) => (
    <Form id="team-invite-form" label={props.view.title} onSubmit={props.on.submit} isPending={props.view.isPending}>
        <Stack gap="row">
            <Input
                id="invite-email"
                name="email"
                kind="email"
                label={props.view.emailLabel}
                isRequired
                isDisabled={props.view.isPending}
                value={props.view.email}
                onValueChange={props.on.setEmail}
            />
            <ChoiceChips
                label={props.view.roleLabel}
                options={props.view.roleOptions.map((option) => ({ ...option, isDisabled: props.view.isPending }))}
                value={props.view.role}
                empty={props.view.roleLabel}
                onValueChange={props.on.setRole}
            />
            <Select
                label={props.view.staffLabel}
                name="staff"
                options={props.view.staffOptions}
                value={props.view.staffId}
                isDisabled={props.view.isPending}
                onValueChange={props.on.setStaffId}
            />
            <Text size="xs" tone="muted">
                {props.view.staffHint}
            </Text>
            {props.view.error === undefined ? null : (
                <Alert tone="negative" title={props.view.failTitle} description={props.view.error} />
            )}
        </Stack>
    </Form>
)

/** What a made invitation shows. */
interface InviteSentProps {
    readonly sent: TeamInviteSentView
    readonly onCopied: () => void
}

/** What follows a made invitation: what was done and the link, shown once. */
const InviteSent = (props: InviteSentProps) => (
    <Stack gap="row">
        <Text live="polite">{props.sent.text}</Text>
        <InviteLink
            id="invite-sent-link"
            label={props.sent.linkLabel}
            link={props.sent.link}
            copyLabel={props.sent.copyLabel}
            copiedLabel={props.sent.copiedLabel}
            note=""
            isCopied={props.sent.isCopied}
            onCopy={props.onCopied}
        />
    </Stack>
)

/** The foot of the drawer: cancel and send while the form is open, done once the invitation is made. */
const InviteFooter = (props: TeamInviteDrawerProps) =>
    props.view.sent === undefined ? (
        <>
            <Button intent="dismiss" isDisabled={props.view.isPending} onPress={props.on.close}>
                {props.view.cancelLabel}
            </Button>
            <Button type="submit" form="team-invite-form" intent="commit" isPending={props.view.isPending}>
                {props.view.submitLabel}
            </Button>
        </>
    ) : (
        <Button intent="commit" onPress={props.on.close}>
            {props.view.doneLabel}
        </Button>
    )

/** The body of the drawer: the form, the made invitation, or the notice an individual plan gets. */
const InviteBody = (props: TeamInviteDrawerProps) => {
    if (props.view.isIndividual) {
        return (
            <EmptyNotice
                message={props.view.individual.title}
                iconSource={nivoIconSource("account", "leading")}
                description={props.view.individual.body}
                actionLabel={props.view.individual.actionLabel}
                actionEndArrow
                onAction={props.on.goTeamPlan}
            />
        )
    }
    if (props.view.sent !== undefined) return <InviteSent sent={props.view.sent} onCopied={props.on.copied} />
    return <InviteForm {...props} />
}

/** The drawer that invites a person, or says an individual plan cannot. */
export const TeamInviteDrawer = (props: TeamInviteDrawerProps) => (
    <Drawer
        isOpen={props.view.isOpen}
        onOpenChange={(isOpen) => {
            if (!isOpen) props.on.close()
        }}
        title={props.view.title}
        description={props.view.sent === undefined ? props.view.description : undefined}
        closeLabel={props.view.closeLabel}
        footer={props.view.isIndividual ? undefined : <InviteFooter {...props} />}
    >
        <InviteBody {...props} />
    </Drawer>
)
