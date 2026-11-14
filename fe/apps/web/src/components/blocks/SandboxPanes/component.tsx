import { Alert, AlertDialog, Button, EmptyNotice, Grid, Page, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { SandboxAccountsCard } from "@/components/composites/SandboxAccountsCard"
import { SandboxAgentsCard } from "@/components/composites/SandboxAgentsCard"
import { SandboxAttachDrawer } from "@/components/composites/SandboxAttachDrawer"
import { SandboxCallsCard } from "@/components/composites/SandboxCallsCard"
import { SandboxCasesCard } from "@/components/composites/SandboxCasesCard"
import { SandboxKeyCard } from "@/components/composites/SandboxKeyCard"
import { SandboxOpenDrawer } from "@/components/composites/SandboxOpenDrawer"
import { SandboxWaitingCard } from "@/components/composites/SandboxWaitingCard"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { SandboxPanesBaseProps } from "@/modules/types"

type Props = SandboxPanesBaseProps

/** The right column of the open account: its cases, its call log, its webhook key, in this order. */
const AccountColumn = (props: Props) => (
    <Stack gap="section">
        <SandboxAgentsCard
            copy={props.props.copy}
            slot={props.props.agents}
            pending={props.props.pending}
            on={{
                attach: props.on.openAttach,
                detach: props.on.askDetach,
                setDefault: props.on.setDefault,
                retry: props.on.retryAccounts,
            }}
        />
        <SandboxCasesCard
            copy={props.props.copy}
            slot={props.props.cases}
            pending={props.props.pending}
            on={{
                setInput: props.on.setInput,
                send: props.on.send,
                choose: props.on.choose,
                retry: props.on.retryCases,
            }}
        />
        <SandboxCallsCard
            copy={props.props.copy}
            slot={props.props.calls}
            pending={props.props.pending}
            on={{ more: props.on.moreCalls, askClear: props.on.askClear, retry: props.on.retryCalls }}
        />
        <SandboxKeyCard
            copy={props.props.copy}
            view={props.props.webhookKey}
            pending={props.props.pending}
            on={{
                reveal: props.on.revealKey,
                hide: props.on.hideKey,
                copy: props.on.copyKey,
                retry: props.on.retryKey,
            }}
        />
    </Stack>
)

/** The question asked before the call log of an account is cleared. */
const ClearQuestion = (props: Props) => (
    <AlertDialog
        isOpen={props.props.isClearAsked}
        onOpenChange={(isOpen) => {
            if (!isOpen) props.on.cancelClear()
        }}
        title={props.props.copy.calls.clearTitle}
        description={props.props.copy.calls.clearBody}
        tone="neutral"
        confirmLabel={props.props.copy.calls.clearConfirm}
        cancelLabel={props.props.copy.cancelLabel}
        isConfirmPending={props.props.pending.isClearing}
        onConfirm={props.on.acceptClear}
        onCancel={props.on.cancelClear}
    />
)

/** The question asked before an agent is taken off the open account. */
const DetachQuestion = (props: Props) => (
    <AlertDialog
        isOpen={props.props.detachAsk !== null}
        onOpenChange={(isOpen) => {
            if (!isOpen) props.on.cancelDetach()
        }}
        title={props.props.copy.agents.detachTitle}
        description={`${props.props.detachAsk?.name ?? ""}: ${props.props.copy.agents.detachBody}`}
        tone="neutral"
        confirmLabel={props.props.copy.agents.detachConfirm}
        cancelLabel={props.props.copy.cancelLabel}
        isConfirmPending={props.props.pending.detachingId !== null}
        onConfirm={props.on.acceptDetach}
        onCancel={props.on.cancelDetach}
    />
)

/** Whether the sandbox has an account to open: nothing is asked of a column that has none. */
const hasAccounts = (props: Props): boolean => !("isEmpty" in props.props.accounts)

/** The sandbox itself: the accounts at the left, the open account's blocks beside them, the parked runs across the full width. */
const SandboxBody = (props: Props) => (
    <Stack gap="section">
        <Grid
            kind="main-rail"
            railPosition="leading"
            railWidth="compact"
            align="start"
            collapsedOrder="rail-first"
            primary={hasAccounts(props) ? <AccountColumn {...props} /> : undefined}
            rail={
                <SandboxAccountsCard
                    copy={props.props.copy}
                    slot={props.props.accounts}
                    onSelect={props.on.select}
                    onRetry={props.on.retryAccounts}
                />
            }
        />
        <SandboxWaitingCard
            copy={props.props.copy}
            locale={props.props.locale}
            slot={props.props.waiting}
            pending={props.props.pending}
            on={{ expire: props.on.expire, retry: props.on.retryWaiting }}
        />
        <ClearQuestion {...props} />
        <DetachQuestion {...props} />
        <SandboxAttachDrawer
            copy={props.props.copy}
            view={props.props.attach}
            on={{
                close: props.on.closeAttach,
                retry: props.on.retryAgents,
                choose: props.on.chooseAttach,
                submit: props.on.submitAttach,
            }}
        />
        <SandboxOpenDrawer
            copy={props.props.copy}
            view={props.props.open}
            on={{
                close: props.on.closeDrawer,
                retryProviders: props.on.retryProviders,
                chooseProvider: props.on.chooseProvider,
                setName: props.on.setName,
                chooseAgents: props.on.chooseAgents,
                retryAgents: props.on.retryAgents,
                submit: props.on.submitOpen,
            }}
        />
    </Stack>
)

/** The one neutral notice of an environment without a sandbox: what it is and what cannot be done here. No control. */
const OffNotice = (props: Props) => (
    <SurfaceCard ariaLabel={props.props.copy.offTitle}>
        <Stack gap="identity">
            <Text isStrong>{props.props.copy.offTitle}</Text>
            <Text size="xs" tone="muted">
                {props.props.copy.offBody}
            </Text>
        </Stack>
    </SurfaceCard>
)

/** The body of the page for the gate it is in. */
const BodyOf = (props: Props) => {
    switch (props.props.gate) {
        case "off":
            return <OffNotice {...props} />
        case "staff":
            return (
                <EmptyNotice
                    message={props.props.copy.staffTitle}
                    iconSource={nivoIconSource("profile", "leading")}
                    description={props.props.copy.staffBody}
                />
            )
        case "failed":
            return (
                <Alert
                    tone="negative"
                    title={props.props.copy.failTitle}
                    description={props.props.copy.failBody}
                    action={{ label: props.props.copy.retryLabel, onAction: props.on.retryGate }}
                />
            )
        case "checking":
        case "on":
            return <SandboxBody {...props} />
    }
}

/** The header: the title with its line and, where the sandbox exists, the page's one primary command (disabled while the switch is asked). */
const headerOf = (props: Props) => {
    const hasSandbox = props.props.gate === "on" || props.props.gate === "checking"
    return {
        breadcrumbs: "root" as const,
        title: props.props.copy.title,
        ...(hasSandbox ? { description: props.props.copy.description } : {}),
        ...(hasSandbox
            ? {
                  actions: (
                      <Button
                          intent="commit"
                          startGlyph="plus"
                          isDisabled={props.props.gate === "checking"}
                          onPress={props.on.openDrawer}
                      >
                          {props.props.copy.openAction}
                      </Button>
                  ),
              }
            : {}),
    }
}

/**
 * Draws the Sandbox page of the dev environment: trial accounts at the left, the open account's cases, call log and webhook key beside
 * them, the runs parked at a wait across the full width. In production the page is one neutral notice with no control.
 */
export const SandboxPanesBase = (props: SandboxPanesBaseProps) => (
    <Page measure="full" header={headerOf(props)}>
        <BodyOf {...props} />
    </Page>
)
