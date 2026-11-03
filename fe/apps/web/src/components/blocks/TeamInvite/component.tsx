import { Form, Input, Select, SurfaceCard, Text, Stack, Grid } from "@starci/grammar/common"
import { FormActions } from "@/components/composites/FormActions"
import { InviteLink } from "@/components/branches/InviteLink"
import { SlotView } from "@nivo/agent-sdk/workbench"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One choice of a select. */
interface ChoiceView {
    readonly id: string
    readonly label: string
}

/** The invitation just sent, ready to copy. */
interface SentView {
    readonly text: string
    readonly link: string
    readonly linkLabel: string
    readonly copyLabel: string
    readonly copiedLabel: string
    readonly isCopied: boolean
}

/** Copy, values and state the connected invite form supplies. */
export interface TeamInviteBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly emailLabel: string
        readonly roleLabel: string
        readonly staffLabel: string
        readonly staffHint: string
        readonly submitLabel: string
        readonly failTitle: string
        readonly roleOptions: ReadonlyArray<ChoiceView>
        readonly email: string
        readonly role: string
        readonly staffId: string
        readonly isPending: boolean
        /** The staff choices: while they load the labels stay and the inputs and the action are skeletons. */
        readonly slot: DataSlot<ReadonlyArray<ChoiceView>>
        readonly placeholder: ReadonlyArray<ChoiceView>
        readonly slotLabels: SlotLabels
        readonly error?: string | undefined
        readonly sent?: SentView | undefined
    }
    readonly on: {
        readonly retry: () => void
        readonly setEmail: (value: string) => void
        readonly setRole: (value: string | null) => void
        readonly setStaffId: (value: string | null) => void
        readonly submit: () => void
        readonly copied: () => void
    }
}

/** Draws the invite form: email, role, optionally the staff row the person is, and the link once sent. */
export const TeamInviteBase = (props: TeamInviteBaseProps) => (
    <div data-guide="team.invite">
        <SurfaceCard label={props.props.title} headingLevel={2}>
            <SlotView
                slot={props.props.slot}
                placeholder={props.props.placeholder}
                labels={props.props.slotLabels}
                onRetry={props.on.retry}
                render={(staffOptions, isSkeleton) => (
                    <Form label={props.props.title} onSubmit={props.on.submit} isPending={props.props.isPending}>
                        <Stack gap="section">
                            <Text size="sm" tone="muted">
                                {props.props.description}
                            </Text>
                            <Grid kind="form" columns={2}>
                                <Input
                                    id="invite-email"
                                    name="email"
                                    kind="email"
                                    label={props.props.emailLabel}
                                    isRequired
                                    isDisabled={props.props.isPending}
                                    isLoading={isSkeleton}
                                    value={props.props.email}
                                    onValueChange={props.on.setEmail}
                                />
                                <Select
                                    label={props.props.roleLabel}
                                    name="role"
                                    options={props.props.roleOptions}
                                    value={props.props.role}
                                    isLoading={isSkeleton}
                                    isDisabled={props.props.isPending}
                                    onValueChange={props.on.setRole}
                                />
                                <Select
                                    label={props.props.staffLabel}
                                    name="staff"
                                    options={staffOptions}
                                    value={props.props.staffId}
                                    isLoading={isSkeleton}
                                    isDisabled={props.props.isPending}
                                    onValueChange={props.on.setStaffId}
                                />
                            </Grid>
                            <Text size="xs" tone="muted">
                                {props.props.staffHint}
                            </Text>
                            {props.props.sent === undefined ? null : (
                                <Stack gap="inline">
                                    <Text size="sm" live="polite">
                                        {props.props.sent.text}
                                    </Text>
                                    <InviteLink
                                        id="invite-sent-link"
                                        label={props.props.sent.linkLabel}
                                        link={props.props.sent.link}
                                        copyLabel={props.props.sent.copyLabel}
                                        copiedLabel={props.props.sent.copiedLabel}
                                        note=""
                                        isCopied={props.props.sent.isCopied}
                                        onCopy={props.on.copied}
                                    />
                                </Stack>
                            )}
                            <FormActions
                                failTitle={props.props.failTitle}
                                error={props.props.error}
                                submitLabel={props.props.submitLabel}
                                isPending={props.props.isPending}
                                isLoading={isSkeleton}
                            />
                        </Stack>
                    </Form>
                )}
            />
        </SurfaceCard>
    </div>
)
