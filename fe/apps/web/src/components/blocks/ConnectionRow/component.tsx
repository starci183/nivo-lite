import { Badge, Button, Cluster, DropdownMenu, IconButton, Link, Stack, Text } from "@starci/grammar/common"
import { ConnectionAccessMenu } from "@/components/composites/ConnectionAccessMenu"
import { ConnectionRowBody, rowMenuEntriesOf } from "@/components/frames/ConnectionRowBody"
import type { RowCommandSet } from "@/components/frames/ConnectionRowBody"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import type { RowView } from "@/modules/types"
import { nivoIconSource } from "@/components/leaves/Icon"

/** What a connection row draws and the commands the owner can give it. */
export interface ConnectionRowBaseProps {
    readonly props: RowView
    readonly on: RowCommandSet
}

const plainFactsOf = (view: RowView): string | undefined => {
    const text = [view.facts, view.usedBy].filter(Boolean).join(" · ")
    return text === "" ? undefined : text
}

/** A connection's detail body; its collection owner carries the id and name while this block keeps its own state and commands. */
export const ConnectionRowBase = (props: ConnectionRowBaseProps) => {
    const view = props.props
    const on = props.on
    const entries = rowMenuEntriesOf(view, on.menu)
    const primary = view.primary
    const factsLine = view.telegramHandle === null ? plainFactsOf(view) : view.usedBy
    return (
        <Stack gap="row">
            <Cluster gap="inline" align="center">
                {primary === null ? null : (
                    <Button
                        intent={primary.intent}
                        isPending={primary.isPending}
                        onPress={() => on.primary(primary.id)}
                    >
                        {primary.label}
                    </Button>
                )}
                {view.page === null ? null : (
                    <Link variant="head" href={view.page.href}>
                        {view.page.label}
                    </Link>
                )}
                {view.access === null ? null : <ConnectionAccessMenu {...view.access} onPick={on.pick} />}
                {entries.length === 0 ? null : (
                    <DropdownMenu
                        placement="bottom end"
                        trigger={
                            <IconButton
                                source={nivoIconSource("more", "leading")}
                                label={view.menuLabel}
                                intent="neutral"
                                isDisabled={view.menuIsDisabled}
                            />
                        }
                        entries={entries}
                    />
                )}
            </Cluster>
            <Stack gap="inline">
                <Cluster gap="inline" align="center">
                    <ProviderLogo {...view.logo} glyph="email" />
                    <Badge isDot tone={view.statusTone}>
                        {view.statusLabel}
                    </Badge>
                    {view.envLabel === null ? null : <Badge tone="neutral">{view.envLabel}</Badge>}
                    {view.telegramHandle === null ? null : (
                        <Link kind="external" href={`https://t.me/${view.telegramHandle}`}>
                            {`@${view.telegramHandle}`}
                        </Link>
                    )}
                </Cluster>
                {factsLine ? (
                    <Text size="sm" tone="muted">
                        {factsLine}
                    </Text>
                ) : null}
            </Stack>
            <ConnectionRowBody view={view} on={on} />
        </Stack>
    )
}
