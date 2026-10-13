import { AlertDialog, Button, Input, Select, SurfaceCard, Text } from "@starci/grammar/common"
import { FormNotice } from "@/components/composites/FormNotice"
import type { AdminInviteRef } from "@/hooks/admin"
import { ACTIONS_CLASS_NAME, ACTION_ROW_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** One plan the select offers. */
export interface AdminPlanOption {
    readonly id: string
    readonly label: string
}

/** Copy, values and state the connected support actions card supplies. */
export interface AdminSupportActionsBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly extendLabel: string
        readonly extendInvalid: string
        readonly extendButton: string
        readonly markActiveLabel: string
        readonly markPastDueLabel: string
        readonly planLabel: string
        readonly planOptions: ReadonlyArray<AdminPlanOption>
        readonly creditsLabel: string
        readonly creditsInvalid: string
        readonly setPlanLabel: string
        readonly confirmLabel: string
        readonly cancelLabel: string
        readonly failTitle: string
        readonly days: string
        readonly plan: string | null
        readonly credits: string
        readonly isDaysValid: boolean
        readonly isCreditsValid: boolean
        readonly isActive: boolean
        readonly isPastDue: boolean
        readonly invites: ReadonlyArray<AdminInviteRef & { readonly label: string }>
        readonly isPending: boolean
        /** The confirmation question, or undefined while no action waits for a yes. */
        readonly question?: string
        readonly isQuestionDangerous: boolean
        readonly error?: string
        readonly done?: string
    }
    readonly on: {
        readonly setDays: (value: string) => void
        readonly setPlan: (value: string | null) => void
        readonly setCredits: (value: string) => void
        readonly askExtend: () => void
        readonly askActive: () => void
        readonly askPastDue: () => void
        readonly askPlan: () => void
        readonly askInvite: (id: string) => void
        readonly confirm: () => void
        readonly dismiss: () => void
    }
}

/** What one text field of the card draws. */
type FieldProps = {
    readonly id: string
    readonly name: string
    readonly label: string
    readonly value: string
    /** Why the value is refused, or undefined while it is fine. */
    readonly error: string | undefined
    readonly onChange: (value: string) => void
}

const Field = (props: FieldProps) => (
    <Input
        id={props.id}
        name={props.name}
        label={props.label}
        variant="secondary"
        value={props.value}
        onValueChange={props.onChange}
        isError={props.error !== undefined}
        errorMessage={props.error}
    />
)

/** What one action button of the card draws. */
type ActionProps = {
    readonly label: string
    readonly variant: "secondary" | "danger-soft" | "outline"
    readonly isDisabled: boolean
    readonly onPress: () => void
}

const Action = (props: ActionProps) => (
    <Button variant={props.variant} isDisabled={props.isDisabled} onPress={props.onPress}>
        {props.label}
    </Button>
)

/** Draws the support actions of one workspace; each one asks for a confirmation in a dialog first. */
export const AdminSupportActionsBase = (props: AdminSupportActionsBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={STACK_CLASS_NAME}>
            <div className={ACTIONS_CLASS_NAME}>
                <div className={ACTION_ROW_CLASS_NAME}>
                    <Field
                        id="extend-days"
                        name="days"
                        label={props.props.extendLabel}
                        value={props.props.days}
                        error={props.props.isDaysValid ? undefined : props.props.extendInvalid}
                        onChange={props.on.setDays}
                    />
                    <Action
                        label={props.props.extendButton}
                        variant="secondary"
                        isDisabled={!props.props.isDaysValid || props.props.isPending}
                        onPress={props.on.askExtend}
                    />
                </div>
                <div className={ACTION_ROW_CLASS_NAME}>
                    <Action
                        label={props.props.markActiveLabel}
                        variant="secondary"
                        isDisabled={props.props.isActive || props.props.isPending}
                        onPress={props.on.askActive}
                    />
                    <Action
                        label={props.props.markPastDueLabel}
                        variant="danger-soft"
                        isDisabled={props.props.isPastDue || props.props.isPending}
                        onPress={props.on.askPastDue}
                    />
                </div>
                <div className={ACTION_ROW_CLASS_NAME}>
                    <Select
                        label={props.props.planLabel}
                        options={props.props.planOptions}
                        value={props.props.plan}
                        onValueChange={props.on.setPlan}
                    />
                    <Field
                        id="admin-credits"
                        name="credits"
                        label={props.props.creditsLabel}
                        value={props.props.credits}
                        error={props.props.isCreditsValid ? undefined : props.props.creditsInvalid}
                        onChange={props.on.setCredits}
                    />
                    <Action
                        label={props.props.setPlanLabel}
                        variant="secondary"
                        isDisabled={props.props.plan === null || !props.props.isCreditsValid || props.props.isPending}
                        onPress={props.on.askPlan}
                    />
                </div>
                {props.props.invites.length > 0 ? (
                    <div className={ACTION_ROW_CLASS_NAME}>
                        {props.props.invites.map((invite) => (
                            <Action
                                key={invite.id}
                                label={invite.label}
                                variant="outline"
                                isDisabled={props.props.isPending}
                                onPress={() => props.on.askInvite(invite.id)}
                            />
                        ))}
                    </div>
                ) : null}
            </div>
            <Text size="sm" tone="muted">
                {props.props.hint}
            </Text>
            <AlertDialog
                isOpen={props.props.question !== undefined}
                onOpenChange={(open) => {
                    if (!open) props.on.dismiss()
                }}
                title={props.props.question ?? ""}
                tone={props.props.isQuestionDangerous ? "negative" : "informative"}
                confirmLabel={props.props.confirmLabel}
                cancelLabel={props.props.cancelLabel}
                isConfirmPending={props.props.isPending}
                onConfirm={props.on.confirm}
                onCancel={props.on.dismiss}
            />
            <FormNotice failTitle={props.props.failTitle} error={props.props.error} done={props.props.done} />
        </div>
    </SurfaceCard>
)
