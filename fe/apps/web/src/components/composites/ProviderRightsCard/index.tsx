import {
    Cluster,
    DropdownMenu,
    IconButton,
    IdentityLockup,
    Link,
    SurfaceCard,
} from "@starci/grammar/common"
import type { useTranslations } from "next-intl"
import type { ProviderHeadView, ProviderRightsCardProps } from "./types"

/** The translator of the agent-account words. */
export type RightsTranslate = ReturnType<typeof useTranslations<"agentRights">>

export type { ProviderRightsCardProps } from "./types"

/** The id of the one row of an account card. */
const ATTACH_ROW = "attach"

/** The input of the head parts. */
interface HeadInput {
    readonly head: ProviderHeadView
}

/** What stands at the end of the head: the link to connect, the more-menu, or nothing. */
const HeadEnd = ({ head }: HeadInput) => {
    if (head.connectLink !== undefined) {
        return (
            <Link variant="head" href={head.connectLink.href}>
                {head.connectLink.label}
            </Link>
        )
    }
    if (head.menu === undefined) return null
    return (
        <DropdownMenu
            placement="bottom end"
            entries={head.menu.entries}
            trigger={<IconButton glyph="more" intent="neutral" label={head.menu.label} size="sm" />}
        />
    )
}

/** The head of an account card: the logo and "<provider> · <account>" over the kind line, its chip beside, the end of the head at the end. */
const Head = ({ head }: HeadInput) => (
    <Cluster gap="inline" justify="between" align="center" wrap={false}>
        <Cluster gap="identity" align="center">
            <IdentityLockup
                title={head.name}
                subtitle={head.line}
                markShape="rounded"
                {...(head.logo === undefined ? {} : { logoSrc: head.logo })}
            />
        </Cluster>
        <HeadEnd head={head} />
    </Cluster>
)

/**
 * One connected account as a card: a head with the provider's logo, "<provider> · <account>", the kind line and a chip (and the
 * more-menu, or the link to connect it), then a choice card with one checkbox row that attaches the agent to the account.
 */
export const ProviderRightsCard = (props: ProviderRightsCardProps) => {
    const view = props.props
    if (view.connectLink !== undefined) {
        return (
            <SurfaceCard kind="body" ariaLabel={view.name}>
                <Head head={view} />
            </SurfaceCard>
        )
    }
    return (
        <SurfaceCard
            kind="select"
            selectionMode="multiple"
            ariaLabel={view.name}
            headers={[{ kind: "custom", children: <Head head={view} /> }]}
            items={[{ id: ATTACH_ROW, title: view.attach.label }]}
            value={view.attach.isOn ? [ATTACH_ROW] : []}
            onChange={(keys) => props.on.toggle(new Set(keys).has(ATTACH_ROW))}
        />
    )
}
