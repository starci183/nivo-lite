import { Badge, Breadcrumbs, Button, SectionHeader, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { AgentMark } from "@/components/leaves/AgentMark"
import type { ModuleIconName } from "@/modules/types"
import {
    ACTION_CLASS,
    CHIPS_CLASS,
    COMPOSER_CLASS,
    COMPOSER_FOOT_CLASS,
    HEAD_CLASS,
    IDENTITY_CLASS,
} from "./classNames"

/** Copy and state of the heading of an agent profile. */
export interface AgentProfileHeadBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly glyph: ModuleIconName
        readonly module: string
        readonly chips: ReadonlyArray<{ readonly id: string; readonly label: string; readonly tone: BadgeTone }>
        readonly isLoading: boolean
        readonly assignLabel: string
        /** False while the agent is paused: nobody can hand it work. */
        readonly canAssign: boolean
        readonly composer: {
            readonly isOpen: boolean
            readonly title: string
            readonly mention: string
            readonly label: string
            readonly placeholder: string
            readonly hint: string
            readonly sendLabel: string
            readonly text: string
            readonly maxLength: number
            readonly canSend: boolean
            readonly isPending: boolean
        }
    }
    readonly on: {
        readonly toggle: () => void
        readonly change: (text: string) => void
        readonly send: () => void
    }
}

/** Draws the agent profile heading: trail, name and role, the identity chips, the "Giao viec" action and its mini composer. */
export const AgentProfileHeadBase = (props: AgentProfileHeadBaseProps) => {
    const view = props.props
    return (
        <div className={HEAD_CLASS}>
            <Breadcrumbs label={view.crumbLabel} items={view.crumbs} />
            <SectionHeader level={1} eyebrow={view.eyebrow} title={view.title} description={view.description} />
            <div className={IDENTITY_CLASS}>
                <AgentMark
                    glyph={nivoIconSource(view.glyph, "leading")}
                    module={view.module}
                    label={view.title}
                    size="lg"
                />
                <div className={CHIPS_CLASS}>
                    {view.chips.map((chip) => (
                        <Badge key={chip.id} tone={chip.tone}>
                            {chip.label}
                        </Badge>
                    ))}
                </div>
                <div className={ACTION_CLASS}>
                    <Button
                        variant="primary"
                        isSkeleton={view.isLoading}
                        isDisabled={!view.canAssign}
                        onPress={props.on.toggle}
                    >
                        {view.assignLabel}
                    </Button>
                </div>
            </div>
            {view.composer.isOpen ? (
                <SurfaceCard label={view.composer.title} headingLevel={2}>
                    <div className={COMPOSER_CLASS}>
                        <Textarea
                            id="agent-assign-text"
                            name="text"
                            label={view.composer.label}
                            placeholder={view.composer.placeholder}
                            value={view.composer.text}
                            rows={3}
                            maxLength={view.composer.maxLength}
                            isDisabled={view.composer.isPending}
                            onValueChange={props.on.change}
                            onSubmitShortcut={props.on.send}
                        />
                        <div className={COMPOSER_FOOT_CLASS}>
                            <Badge tone="accent">{view.composer.mention}</Badge>
                            <Text size="sm" tone="muted">
                                {view.composer.hint}
                            </Text>
                            <Button
                                variant="primary"
                                isPending={view.composer.isPending}
                                isDisabled={!view.composer.canSend}
                                onPress={props.on.send}
                            >
                                {view.composer.sendLabel}
                            </Button>
                        </div>
                    </div>
                </SurfaceCard>
            ) : null}
        </div>
    )
}
