import { EmptyNotice, Stack } from "@starci/grammar/common"
import { SandboxAgentChoices } from "@/components/branches/SandboxAgentChoices"
import { SandboxFormDrawer, sandboxFormDrawerPropsOf } from "@/components/branches/SandboxFormDrawer"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { SandboxAttachView, SandboxCopy } from "@/modules/types"

/** What the drawer draws and does. */
interface SandboxAttachDrawerProps {
    readonly copy: SandboxCopy
    readonly view: SandboxAttachView
    readonly on: {
        readonly close: () => void
        readonly retry: () => void
        readonly choose: (agentIds: ReadonlyArray<string>) => void
        readonly submit: () => void
    }
}

/** The drawer that gives the open account to more agents: the agents it is not attached to as a choice list, and the one command at the foot. */
export const SandboxAttachDrawer = (props: SandboxAttachDrawerProps) => (
    <SandboxFormDrawer
        {...sandboxFormDrawerPropsOf({
            formId: "sandbox-attach-form",
            view: props.view,
            isSubmitDisabled: props.view.agentIds.length === 0,
            copy: {
                title: props.copy.attach.title,
                hint: props.copy.attach.hint,
                submitLabel: props.copy.attach.submitLabel,
            },
            cancelLabel: props.copy.cancelLabel,
            on: props.on,
        })}
        fields={
            <Stack gap="row">
                <SandboxAgentChoices
                    copy={props.copy}
                    label={props.copy.attach.agentsLabel}
                    slot={props.view.agents}
                    value={props.view.agentIds}
                    isPending={props.view.isPending}
                    empty={
                        <EmptyNotice
                            message={props.copy.attach.empty}
                            iconSource={nivoIconSource("profile", "leading")}
                        />
                    }
                    onChange={props.on.choose}
                    onRetry={props.on.retry}
                />
            </Stack>
        }
    />
)
