import {
    Alert,
    Button,
    Code,
    CopyField,
    Drawer,
    IconTile,
    Select,
    Stack,
    Switch,
    Tabs,
    Text,
} from "@starci/grammar/common"
import { DrawerFooter } from "@/components/composites/DrawerFooter"
import { nivoIconSource } from "@/components/leaves/Icon"
import { ALL_OPTION } from "@/modules/inbox"
import type { InboxCopy } from "@/modules/inbox"
import type { InboxWebsiteView } from "@/modules/types"

/** Props for {@link InboxWebsiteDrawer}. */
export interface InboxWebsiteDrawerProps {
    readonly props: {
        readonly copy: InboxCopy
        readonly view: InboxWebsiteView
        /** The last save did not go through. */
        readonly failed: boolean
    }
    readonly on: {
        readonly close: () => void
        readonly openConnections: () => void
        readonly selectTab: (id: string) => void
        readonly setChat: (on: boolean) => void
        readonly setForm: (on: boolean) => void
        readonly setPrices: (on: boolean) => void
        readonly setAgent: (id: string) => void
        readonly save: () => void
        readonly copy: (text: string) => void
    }
}

/** The first step: what to paste or post, by the way the owner chose. */
const StepOne = (props: InboxWebsiteDrawerProps) => {
    const { copy, view } = props.props
    if (view.tab === "link") {
        return (
            <Stack gap="row">
                <Text isStrong>{copy.webStepLink}</Text>
                <CopyField
                    label={copy.webCopyUrl}
                    value={view.formUrl}
                    copyLabel={copy.webCopy}
                    copiedLabel={copy.webCopied}
                    copyErrorLabel={copy.webCopyFailed}
                />
                <Text size="sm" tone="muted">
                    {copy.webLinkHint}
                </Text>
            </Stack>
        )
    }
    if (view.tab === "hook") {
        return (
            <Stack gap="row">
                <Text isStrong>{copy.webStepHook}</Text>
                <Text size="sm" tone="muted">
                    {copy.webHookHint}
                </Text>
                <Button endArrow intent="alternative" onPress={props.on.openConnections}>
                    {copy.actionConnections}
                </Button>
            </Stack>
        )
    }
    return (
        <Stack gap="row">
            <Text isStrong>{copy.webStepPaste}</Text>
            <Text size="sm" tone="muted">
                {copy.webEmbedHint}
            </Text>
            <Code>{view.snippet}</Code>
            <Button
                intent="neutral"
                onPress={() => props.on.copy(view.snippet)}
            >
                {copy.webCopyCode}
            </Button>
        </Stack>
    )
}

/** The second step: the three things the site can show, each with its own switch. */
const StepTwo = (props: InboxWebsiteDrawerProps) => {
    const { copy, view } = props.props
    return (
        <Stack gap="row">
            <Text isStrong>{copy.webStepShow}</Text>
            <Switch
                label={copy.webChatTitle}
                description={copy.webChatBody}
                isSelected={view.chatOn}
                onSelectedChange={props.on.setChat}
            />
            <Switch
                label={copy.webFormTitle}
                description={copy.webFormBody}
                isSelected={view.formOn}
                onSelectedChange={props.on.setForm}
            />
            <Switch
                label={copy.webPricesTitle}
                description={copy.webPricesBody}
                isSelected={view.pricesOn}
                onSelectedChange={props.on.setPrices}
            />
            <Text size="xs" tone="muted">
                {copy.webPendingNote}
            </Text>
        </Stack>
    )
}

/**
 * The drawer that connects the website: how to put the form on the site (the code to paste, the address the form posts to, a webhook for
 * another system), what the site shows, and the agent that takes the customers. Saving turns the intake on.
 */
export const InboxWebsiteDrawer = (props: InboxWebsiteDrawerProps) => {
    const { copy, view, failed } = props.props
    return (
        <Drawer
            isOpen={view.isOpen}
            onOpenChange={(open) => {
                if (!open) props.on.close()
            }}
            title={copy.webTitle}
            description={copy.webBody}
            leading={<IconTile source={nivoIconSource("explore", "leading")} tone="accent" />}
            closeLabel={copy.webClose}
            placement="right"
            isLoading={view.isLoading}
            footer={
                <DrawerFooter
                    cancelLabel={copy.webCancel}
                    submitLabel={view.isEnabled ? copy.webSave : copy.webEnable}
                    isPending={view.isPending}
                    onCancel={props.on.close}
                    onSubmit={props.on.save}
                />
            }
        >
            <Stack gap="section">
                <Tabs
                    appearance="primary"
                    label={copy.webTabsLabel}
                    selectedKey={view.tab}
                    onSelect={props.on.selectTab}
                    items={[
                        { id: "embed", label: copy.webTabEmbed },
                        { id: "link", label: copy.webTabLink },
                        { id: "hook", label: copy.webTabHook },
                    ]}
                />
                <StepOne {...props} />
                <StepTwo {...props} />
                <Stack gap="row">
                    <Text isStrong>{copy.webStepAgent}</Text>
                    <Select
                        label={copy.webAgentLabel}
                        options={[{ id: ALL_OPTION, label: copy.assignNobody }, ...view.agents]}
                        value={view.agent}
                        onValueChange={(id) => {
                            if (id !== null) props.on.setAgent(id)
                        }}
                    />
                </Stack>
                {failed ? <Alert tone="negative" title={copy.webFailed} /> : null}
            </Stack>
        </Drawer>
    )
}
