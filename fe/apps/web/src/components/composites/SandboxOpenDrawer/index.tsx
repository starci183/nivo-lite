import { Input, Stack, SurfaceCard } from "@starci/grammar/common"
import { sandboxCardStateOf } from "@/components/branches/SandboxCardState"
import { SandboxAgentChoices } from "@/components/branches/SandboxAgentChoices"
import { SandboxFormDrawer, sandboxFormDrawerPropsOf } from "@/components/branches/SandboxFormDrawer"
import type { SandboxCopy, SandboxOpenView } from "@/modules/types"

/** What the drawer draws and does. */
interface SandboxOpenDrawerProps {
    readonly copy: SandboxCopy
    readonly view: SandboxOpenView
    readonly on: {
        readonly close: () => void
        readonly retryProviders: () => void
        readonly chooseProvider: (provider: string) => void
        readonly setName: (value: string) => void
        readonly chooseAgents: (agentIds: ReadonlyArray<string>) => void
        readonly retryAgents: () => void
        readonly submit: () => void
    }
}

/** The providers while they are read: no row, the card keeps its label. */
const NO_PROVIDERS: ReadonlyArray<{ readonly id: string; readonly label: string }> = []

/**
 * The drawer that creates a sandbox account: the provider as a choice list, the account's name, the agents to give it to (left out
 * while the workspace has none), and the one command at the foot.
 */
export const SandboxOpenDrawer = (props: SandboxOpenDrawerProps) => {
    const providers = sandboxCardStateOf(props.view.providers, NO_PROVIDERS, NO_PROVIDERS, {
        message: props.copy.failTitle,
        retryLabel: props.copy.retryLabel,
        onRetry: props.on.retryProviders,
    })
    return (
        <SandboxFormDrawer
            {...sandboxFormDrawerPropsOf({
                formId: "sandbox-open-form",
                view: props.view,
                isSubmitDisabled: props.view.provider === null || props.view.name.trim() === "",
                copy: {
                    title: props.copy.open.title,
                    hint: props.copy.open.hint,
                    submitLabel: props.copy.open.submitLabel,
                },
                cancelLabel: props.copy.cancelLabel,
                on: props.on,
            })}
            fields={
            <Stack gap="row">
                <SurfaceCard
                    kind="select"
                    sublabel={props.copy.open.providerLabel}
                    selectionMode="single"
                    value={props.view.provider}
                    onChange={props.on.chooseProvider}
                    isLoading={providers.isLoading}
                    {...(providers.error === undefined ? {} : { error: providers.error })}
                    items={providers.data.map((choice) => ({
                        id: choice.id,
                        title: choice.label,
                        isDisabled: props.view.isPending,
                    }))}
                />
                <Input
                    id="sandbox-open-name"
                    name="name"
                    label={props.copy.open.nameLabel}
                    isRequired
                    isDisabled={props.view.isPending}
                    value={props.view.name}
                    onValueChange={props.on.setName}
                />
                <SandboxAgentChoices
                    copy={props.copy}
                    label={props.copy.open.agentsLabel}
                    slot={props.view.agents}
                    value={props.view.agentIds}
                    isPending={props.view.isPending}
                    onChange={props.on.chooseAgents}
                    onRetry={props.on.retryAgents}
                />
            </Stack>
            }
        />
    )
}
