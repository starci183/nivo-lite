import { Button, DescriptionList, Form, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { FormNotice } from "@/components/composites/FormNotice"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** Copy, values and state the connected email card supplies. */
export interface AccountEmailBaseProps {
    readonly props: {
        readonly title: string
        readonly currentLabel: string
        /** The address of the account, once the read arrived. */
        readonly slot: DataSlot<string>
        readonly labels: SlotLabels
        readonly hint: string
        readonly changeLabel: string
        readonly newEmailLabel: string
        readonly sendLabel: string
        readonly cancelLabel: string
        readonly failTitle: string
        readonly value: string
        readonly isEditing: boolean
        readonly isPending: boolean
        readonly error?: string | undefined
        readonly done?: string
    }
    readonly on: {
        readonly setValue: (value: string) => void
        readonly submit: () => void
        readonly startEdit: () => void
        readonly cancel: () => void
        readonly retry: () => void
    }
}

/** Draws the email card: the current address, and the change form once the person asks for it. */
export const AccountEmailBase = (props: AccountEmailBaseProps) => (
    <SlotView slot={props.props.slot} placeholder="" labels={props.props.labels} onRetry={props.on.retry}>
        {(email, isSkeleton) => (
            <SurfaceCard label={props.props.title} headingLevel={2}>
                <div className={FORM_CLASS_NAME}>
                    <DescriptionList
                        layout="stacked"
                        isLoading={isSkeleton}
                        items={[
                            {
                                id: "email",
                                term: props.props.currentLabel,
                                description: <Text weight="medium">{email}</Text>,
                            },
                        ]}
                    />
                    <Text size="sm" tone="muted">
                        {props.props.hint}
                    </Text>
                    {props.props.isEditing ? (
                        <Form
                            label={props.props.changeLabel}
                            onSubmit={props.on.submit}
                            isPending={props.props.isPending}
                        >
                            <div className={FORM_CLASS_NAME}>
                                <Input
                                    id="account-new-email"
                                    name="email"
                                    kind="email"
                                    label={props.props.newEmailLabel}
                                    isRequired
                                    isDisabled={props.props.isPending}
                                    value={props.props.value}
                                    onValueChange={props.on.setValue}
                                />
                                <div className={ACTIONS_CLASS_NAME}>
                                    <Button type="submit" intent="commit" isPending={props.props.isPending}>
                                        {props.props.sendLabel}
                                    </Button>
                                    <Button
                                        intent="neutral"
                                        isDisabled={props.props.isPending}
                                        onPress={props.on.cancel}
                                    >
                                        {props.props.cancelLabel}
                                    </Button>
                                </div>
                            </div>
                        </Form>
                    ) : (
                        <div className={ACTIONS_CLASS_NAME}>
                            <Button intent="neutral" isSkeleton={isSkeleton} onPress={props.on.startEdit}>
                                {props.props.changeLabel}
                            </Button>
                        </div>
                    )}
                    <FormNotice failTitle={props.props.failTitle} error={props.props.error} done={props.props.done} />
                </div>
            </SurfaceCard>
        )}
    </SlotView>
)
