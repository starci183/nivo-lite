import type { useTranslations } from "next-intl"
import type { useMember } from "@/hooks/member"
import type { useIndividualPlan } from "@/hooks/billing"
import type { useTeam, useInviteCommands, InviteSentView } from "@/hooks/team"
import type { useInviteForm } from "@/hooks/rhf"
import { Form, Input, Select, SurfaceCard, Text } from "@starci/grammar/common"
import { FormActions } from "@/components/composites/FormActions"
import { InviteLink } from "@/components/composites/InviteLink"
import { FORM_GRID_CLASS_NAME, SENT_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

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
        readonly staffOptions: ReadonlyArray<ChoiceView>
        readonly email: string
        readonly role: string
        readonly staffId: string
        readonly isPending: boolean
        /** The choices are loading: the labels stay, the inputs and the action are skeletons. */
        readonly isSkeleton: boolean
        readonly error?: string | undefined
        readonly sent?: SentView | undefined
    }
    readonly on: {
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
            <Form label={props.props.title} onSubmit={props.on.submit} isPending={props.props.isPending}>
                <div className={STACK_CLASS_NAME}>
                    <Text size="sm" tone="muted">
                        {props.props.description}
                    </Text>
                    <div className={FORM_GRID_CLASS_NAME}>
                        <Input
                            id="invite-email"
                            name="email"
                            kind="email"
                            label={props.props.emailLabel}
                            isRequired
                            isDisabled={props.props.isPending}
                            isSkeleton={props.props.isSkeleton}
                            value={props.props.email}
                            onValueChange={props.on.setEmail}
                        />
                        <Select
                            label={props.props.roleLabel}
                            name="role"
                            options={props.props.roleOptions}
                            value={props.props.role}
                            isSkeleton={props.props.isSkeleton}
                            isDisabled={props.props.isPending}
                            onValueChange={props.on.setRole}
                        />
                        <Select
                            label={props.props.staffLabel}
                            name="staff"
                            options={props.props.staffOptions}
                            value={props.props.staffId}
                            isSkeleton={props.props.isSkeleton}
                            isDisabled={props.props.isPending}
                            onValueChange={props.on.setStaffId}
                        />
                    </div>
                    <Text size="xs" tone="muted">
                        {props.props.staffHint}
                    </Text>
                    {props.props.sent === undefined ? null : (
                        <div className={SENT_CLASS_NAME}>
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
                        </div>
                    )}
                    <FormActions
                        failTitle={props.props.failTitle}
                        error={props.props.error}
                        submitLabel={props.props.submitLabel}
                        isPending={props.props.isPending}
                        isSkeleton={props.props.isSkeleton}
                    />
                </div>
            </Form>
        </SurfaceCard>
    </div>
)

/** State values and commands consumed by the connected surface. */
export type TeamInviteControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"team">>
    readonly member: ReturnType<typeof useMember>
    readonly isIndividual: ReturnType<typeof useIndividualPlan>
    readonly isAllowed: boolean
    readonly views: ReturnType<typeof useTeam>["views"]
    readonly isLoading: ReturnType<typeof useTeam>["isLoading"]
    readonly commands: ReturnType<typeof useInviteCommands>
    readonly form: ReturnType<typeof useInviteForm>
    readonly sent: InviteSentView | undefined
    readonly setSent: React.Dispatch<React.SetStateAction<InviteSentView | undefined>>
    readonly isCopied: boolean
    readonly setCopied: React.Dispatch<React.SetStateAction<boolean>>
}
