import {
    Alert,
    Button,
    Dialog,
    DescriptionList,
    EmptyNotice,
    Form,
    Input,
    Stack,
    SurfaceCard,
    Text,
    type ListRowData,
} from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { AccountSignInView, DataSlot, SlotLabels } from "@/modules/types"

/** Copy, values and state the connected sign-in card supplies. */
export interface AccountSignInBaseProps {
    readonly props: {
        readonly title: string
        readonly emailLabel: string
        readonly emailHint: string
        readonly linkedLabel: string
        readonly notLinkedLabel: string
        /** The line under the password row: the shortest password. */
        readonly methodHint: string
        readonly changeLabel: string
        /** The address and the methods once the account read arrived. */
        readonly slot: DataSlot<AccountSignInView>
        /** The ready shape: the address and the two methods, with their words and no values. */
        readonly placeholder: AccountSignInView
        readonly labels: SlotLabels
        readonly password: {
            readonly isOpen: boolean
            readonly title: string
            /** The sentence under the dialog heading. */
            readonly hint: string
            readonly closeLabel: string
            readonly cancelLabel: string
            readonly currentLabel: string
            readonly newLabel: string
            readonly newHint: string
            readonly confirmLabel: string
            readonly failTitle: string
            readonly current: string
            readonly next: string
            readonly confirm: string
            readonly isPending: boolean
            readonly error?: string | undefined
        }
    }
    readonly on: {
        readonly retry: () => void
        readonly openPassword: () => void
        readonly closePassword: () => void
        readonly setCurrent: (value: string) => void
        readonly setNext: (value: string) => void
        readonly setConfirm: (value: string) => void
        readonly submitPassword: () => void
    }
}

/** The methods as rows: Google with its status, the password with its status and the command that opens its dialog. */
const methodRows = (props: AccountSignInBaseProps, view: AccountSignInView): ReadonlyArray<ListRowData> =>
    view.methods.map((method): ListRowData => ({
        id: method.id,
        title: method.label,
        leading: { icon: nivoIconSource(method.id === "google" ? "google" : "password", "leading") },
        ...(method.id === "google" ? {} : { description: props.props.methodHint }),
        badges: [
            {
                label: method.isLinked ? props.props.linkedLabel : props.props.notLinkedLabel,
                tone: method.isLinked ? "success" : "neutral",
            },
        ],
        ...(method.id === "google" || !method.isLinked
            ? {}
            : {
                  action: {
                      label: props.props.changeLabel,
                      intent: "alternative" as const,
                      press: props.on.openPassword,
                  },
              }),
    }))

/** The dialog that changes the password: three fields, the safe way out and the one commit. */
const PasswordDialog = (props: AccountSignInBaseProps) => {
    const view = props.props.password
    return (
        <Dialog
            isOpen={view.isOpen}
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.closePassword()
            }}
            title={view.title}
            description={view.hint}
            closeLabel={view.closeLabel}
            footer={
                <>
                    <Button intent="dismiss" isDisabled={view.isPending} onPress={props.on.closePassword}>
                        {view.cancelLabel}
                    </Button>
                    <Button type="submit" form="account-password-form" intent="commit" isPending={view.isPending}>
                        {props.props.changeLabel}
                    </Button>
                </>
            }
        >
            <Form
                id="account-password-form"
                label={view.title}
                onSubmit={props.on.submitPassword}
                isPending={view.isPending}
            >
                <Stack gap="section">
                    <Input
                        id="account-current-password"
                        name="current"
                        kind="password"
                        label={view.currentLabel}
                        isRequired
                        isDisabled={view.isPending}
                        value={view.current}
                        onValueChange={props.on.setCurrent}
                    />
                    <Input
                        id="account-new-password"
                        name="next"
                        kind="newPassword"
                        label={view.newLabel}
                        description={view.newHint}
                        isRequired
                        isDisabled={view.isPending}
                        value={view.next}
                        onValueChange={props.on.setNext}
                    />
                    <Input
                        id="account-confirm-password"
                        name="confirm"
                        kind="newPassword"
                        label={view.confirmLabel}
                        isRequired
                        isDisabled={view.isPending}
                        value={view.confirm}
                        onValueChange={props.on.setConfirm}
                    />
                    {view.error === undefined ? null : (
                        <Alert tone="negative" title={view.failTitle} description={view.error} />
                    )}
                </Stack>
            </Form>
        </Dialog>
    )
}

/**
 * Draws how the person signs in as one card of two bands under its label: the address, then the methods with their status and
 * the password's change command, which opens its form in a dialog. The card keeps its box while the account loads.
 */
export const AccountSignInBase = (props: AccountSignInBaseProps) => (
    <>
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.labels}
            onRetry={props.on.retry}
            render={(view, isSkeleton) => (
                <SurfaceCard
                    kind="list"
                    label={props.props.title}
                    headingLevel={2}
                    isLoading={isSkeleton}
                    headers={[
                        {
                            kind: "custom",
                            children: (
                                <Stack gap="row">
                                    <DescriptionList
                                        layout="stacked"
                                        isLoading={isSkeleton}
                                        items={[
                                            {
                                                id: "email",
                                                term: props.props.emailLabel,
                                                description: <Text isStrong>{view.email}</Text>,
                                            },
                                        ]}
                                    />
                                    <Text size="sm" tone="muted">
                                        {props.props.emailHint}
                                    </Text>
                                </Stack>
                            ),
                        },
                    ]}
                    items={methodRows(props, view)}
                    empty={<EmptyNotice message={props.props.labels.empty} />}
                />
            )}
        />
        <PasswordDialog {...props} />
    </>
)
