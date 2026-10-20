import { Alert, Badge, Button, DescriptionList, DragItem, Input, Text, Textarea } from "@starci/grammar/common"
import type { BrandKitText, BrandProposalCardView } from "@/hooks/content"
import { ACTIONS, CARD, FIELDS, HEAD, SWATCHES } from "./classNames"

/** The commands of one brand proposal card. */
export interface BrandProposalCommands {
    readonly field: (name: keyof BrandKitText, value: string) => void
    readonly confirm: (id: string) => void
    readonly toggleEdit: (id: string) => void
    readonly reject: (id: string) => void
}

/** What one brand proposal draws: the kit read from the guideline, and the edit when it is open. */
interface BrandProposalViewProps {
    readonly props: BrandProposalCardView
    readonly on: BrandProposalCommands
}

const LINE_FIELDS: ReadonlyArray<keyof BrandKitText> = ["colors", "fonts", "imagery", "avoid"]

const EditFields = (props: BrandProposalViewProps) => {
    const card = props.props
    const { on } = props
    return (
        <div className={FIELDS}>
            <Input
                id={`brand-${card.id}-name`}
                name="brandName"
                variant="secondary"
                label={card.labels.brandName}
                value={card.fields.brandName}
                onValueChange={(value) => on.field("brandName", value)}
            />
            <Textarea
                variant="secondary"
                name={`brand-${card.id}-tone`}
                label={card.labels.tone}
                rows={2}
                maxLength={400}
                value={card.fields.tone}
                onValueChange={(value) => on.field("tone", value)}
            />
            <Input
                id={`brand-${card.id}-address`}
                name="address"
                variant="secondary"
                label={card.labels.address}
                value={card.fields.address}
                onValueChange={(value) => on.field("address", value)}
            />
            {LINE_FIELDS.map((name) => (
                <Textarea
                    key={name}
                    variant="secondary"
                    name={`brand-${card.id}-${name}`}
                    label={card.labels[name]}
                    description={name === "colors" ? card.colorsHint : undefined}
                    rows={3}
                    maxLength={2000}
                    value={card.fields[name]}
                    onValueChange={(value) => on.field(name, value)}
                />
            ))}
        </div>
    )
}

const Waiting = (props: BrandProposalViewProps) => {
    const card = props.props
    const { on } = props
    return (
        <div className={CARD}>
            <div className={HEAD}>
                <Text weight="semibold" size="sm">
                    {card.head}
                </Text>
                <Badge tone="warning">{card.waitingLabel}</Badge>
            </div>
            <Text size="xs" tone="muted">
                {card.colorsLabel}
            </Text>
            <div className={SWATCHES}>
                {card.colors.map((color) => (
                    <DragItem key={`${color.name}-${color.hex}`} isDisabled leadingColor={color.hex}>
                        <Text size="sm">{`${color.name} · ${color.hex}`}</Text>
                    </DragItem>
                ))}
            </div>
            <DescriptionList layout="stacked" items={card.items} />
            {card.isEditing ? <EditFields {...props} /> : null}
            {card.error === "" ? null : <Alert tone="negative" title={card.error} />}
            <div className={ACTIONS}>
                <Button variant="primary" size="sm" isPending={card.isPending} onPress={() => on.confirm(card.id)}>
                    {card.confirmLabel}
                </Button>
                <Button variant="ghost" size="sm" isDisabled={card.isPending} onPress={() => on.toggleEdit(card.id)}>
                    {card.editLabel}
                </Button>
                <Button variant="ghost" size="sm" isDisabled={card.isPending} onPress={() => on.reject(card.id)}>
                    {card.rejectLabel}
                </Button>
            </div>
        </div>
    )
}

/** Draws one brand proposal of the setup chat: a decided one is a line; a waiting one shows the palette, fonts, tone and imagery
 * read from the guideline, with Confirm, Edit and Reject. */
export const BrandProposalView = (props: BrandProposalViewProps) => {
    const card = props.props
    if (card.decidedLine === "") return <Waiting {...props} />
    return (
        <div className={CARD}>
            <div className={HEAD}>
                <Text size="sm" tone="muted">
                    {card.decidedLine}
                </Text>
                <Badge isDot tone={card.decidedTone}>
                    {card.decidedLabel}
                </Badge>
            </div>
        </div>
    )
}
