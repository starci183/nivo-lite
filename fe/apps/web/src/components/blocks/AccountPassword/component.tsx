import { Form, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { FormActions } from "@/components/composites/FormActions"
import { FORM_CLASS_NAME } from "./classNames"

/** Copy, values and state the connected password card supplies. */
export interface AccountPasswordBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly currentLabel: string
        readonly newLabel: string
        readonly confirmLabel: string
        readonly submitLabel: string
        readonly failTitle: string
        readonly current: string
        readonly next: string
        readonly confirm: string
        readonly isPending: boolean
        readonly isLoading: boolean
        readonly error?: string | undefined
        readonly done?: string
    }
    readonly on: {
        readonly setCurrent: (value: string) => void
        readonly setNext: (value: string) => void
        readonly setConfirm: (value: string) => void
        readonly submit: () => void
    }
}

/** Draws the password card without reading copy, navigation or database state. */
export const AccountPasswordBase = (props: AccountPasswordBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <Form label={props.props.title} onSubmit={props.on.submit} isPending={props.props.isPending}>
            <div className={FORM_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {props.props.hint}
                </Text>
                <Input
                    id="account-current-password"
                    name="current"
                    kind="password"
                    label={props.props.currentLabel}
                    variant="secondary"
                    isRequired
                    isDisabled={props.props.isPending}
                    isSkeleton={props.props.isLoading}
                    value={props.props.current}
                    onValueChange={props.on.setCurrent}
                />
                <Input
                    id="account-new-password"
                    name="next"
                    kind="newPassword"
                    label={props.props.newLabel}
                    variant="secondary"
                    isRequired
                    isDisabled={props.props.isPending}
                    isSkeleton={props.props.isLoading}
                    value={props.props.next}
                    onValueChange={props.on.setNext}
                />
                <Input
                    id="account-confirm-password"
                    name="confirm"
                    kind="newPassword"
                    label={props.props.confirmLabel}
                    variant="secondary"
                    isRequired
                    isDisabled={props.props.isPending}
                    isSkeleton={props.props.isLoading}
                    value={props.props.confirm}
                    onValueChange={props.on.setConfirm}
                />
                <FormActions
                    failTitle={props.props.failTitle}
                    error={props.props.error}
                    done={props.props.done}
                    submitLabel={props.props.submitLabel}
                    isPending={props.props.isPending}
                    isSkeleton={props.props.isLoading}
                />
            </div>
        </Form>
    </SurfaceCard>
)
