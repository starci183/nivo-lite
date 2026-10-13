import {
    Alert,
    Badge,
    Button,
    Checkbox,
    CheckboxGroup,
    EmptyNotice,
    Input,
    ListItem,
    SurfaceCard,
    SurfaceListCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import {
    BODY_CLASS_NAME,
    CHECKS_CLASS_NAME,
    CHIPS_CLASS_NAME,
    FIELD_PAIR_CLASS_NAME,
    FORM_CLASS_NAME,
    QUOTE_CLASS_NAME,
    ROW_CLASS_NAME,
    ROW_MAIN_CLASS_NAME,
} from "./classNames"

/** One line of the live count under the segment. */
export interface LoyaltyPromoPreviewLine {
    readonly id: string
    readonly text: string
    readonly emphasis: boolean
}

/** The message the back end wrote for the offer just sent in. */
export interface LoyaltyPromoResult {
    readonly title: string
    readonly recipients: string
    readonly time: string
    readonly draft: string
}

/** One offer already prepared. */
export interface LoyaltyPromoRow {
    readonly id: string
    readonly name: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly counts: string
    readonly meta: string
    readonly draft: string
}

/** Props for {@link LoyaltyPromoBase}. */
export interface LoyaltyPromoBaseProps {
    readonly props: {
        readonly canManage: boolean
        readonly copy: {
            readonly title: string
            readonly body: string
            readonly tiers: string
            readonly tiersHint: string
            readonly inactive: string
            readonly inactiveHint: string
            readonly spend: string
            readonly spendHint: string
            readonly birthday: string
            readonly name: string
            readonly nameHint: string
            readonly brief: string
            readonly briefHint: string
            readonly submit: string
            readonly drafting: string
            readonly failedTitle: string
            readonly draftLabel: string
            readonly managersOnly: string
            readonly managersOnlyBody: string
            readonly campaignsTitle: string
            readonly campaignsEmptyTitle: string
            readonly campaignsEmptyBody: string
        }
        readonly tierOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly values: {
            readonly tiers: ReadonlyArray<string>
            readonly inactive: string
            readonly spend: string
            readonly birthday: boolean
            readonly name: string
            readonly brief: string
        }
        readonly briefError?: string
        readonly previewLines: ReadonlyArray<LoyaltyPromoPreviewLine>
        readonly briefMax: number
        readonly isBusy: boolean
        readonly isDrafting: boolean
        readonly isSubmitDisabled: boolean
        readonly result?: LoyaltyPromoResult
        readonly failure?: string
        readonly rows: ReadonlyArray<LoyaltyPromoRow>
    }
    readonly on: {
        readonly setTiers: (value: ReadonlyArray<string>) => void
        readonly setInactive: (value: string) => void
        readonly setSpend: (value: string) => void
        readonly setBirthday: (value: boolean) => void
        readonly setName: (value: string) => void
        readonly setBrief: (value: string) => void
        readonly submit: () => void
    }
}

/** Draws the promotion builder (segment, live count, offer text, the drafted message) and the list of offers already prepared; staff see a notice instead of the builder. */
export const LoyaltyPromoBase = (props: LoyaltyPromoBaseProps) => {
    const { canManage, copy, values, result, failure, briefError } = props.props
    const on = props.on
    return (
        <>
            {canManage ? (
                <SurfaceCard label={copy.title} headingLevel={2}>
                    <div className={BODY_CLASS_NAME}>
                        <Text size="sm" tone="muted">
                            {copy.body}
                        </Text>
                        <div className={FORM_CLASS_NAME}>
                            <CheckboxGroup
                                label={copy.tiers}
                                description={copy.tiersHint}
                                orientation="horizontal"
                                variant="secondary"
                                options={[...props.props.tierOptions]}
                                value={[...values.tiers]}
                                isDisabled={props.props.isBusy}
                                onValueChange={on.setTiers}
                            />
                            <div className={FIELD_PAIR_CLASS_NAME}>
                                <Input
                                    id="seg-inactive"
                                    name="inactive"
                                    label={copy.inactive}
                                    variant="secondary"
                                    hint={copy.inactiveHint}
                                    placeholder="45"
                                    value={values.inactive}
                                    isDisabled={props.props.isBusy}
                                    onValueChange={on.setInactive}
                                />
                                <Input
                                    id="seg-spend"
                                    name="spend"
                                    label={copy.spend}
                                    variant="secondary"
                                    hint={copy.spendHint}
                                    placeholder="1000000"
                                    value={values.spend}
                                    isDisabled={props.props.isBusy}
                                    onValueChange={on.setSpend}
                                />
                            </div>
                            <div className={CHECKS_CLASS_NAME}>
                                <Checkbox
                                    label={copy.birthday}
                                    variant="secondary"
                                    isSelected={values.birthday}
                                    isDisabled={props.props.isBusy}
                                    onSelectedChange={on.setBirthday}
                                />
                            </div>
                        </div>

                        <SurfaceCard depth="nested">
                            <div className={BODY_CLASS_NAME} aria-live="polite">
                                {props.props.previewLines.map((line) => (
                                    <Text
                                        key={line.id}
                                        size={line.emphasis ? "md" : "xs"}
                                        weight={line.emphasis ? "semibold" : "normal"}
                                        tone={line.emphasis ? "default" : "muted"}
                                    >
                                        {line.text}
                                    </Text>
                                ))}
                            </div>
                        </SurfaceCard>

                        <div className={FORM_CLASS_NAME}>
                            <Input
                                id="promo-name"
                                name="name"
                                label={copy.name}
                                variant="secondary"
                                hint={copy.nameHint}
                                value={values.name}
                                isDisabled={props.props.isBusy}
                                onValueChange={on.setName}
                            />
                            <Textarea
                                label={copy.brief}
                                variant="secondary"
                                description={copy.briefHint}
                                errorMessage={briefError}
                                rows={4}
                                maxLength={props.props.briefMax}
                                value={values.brief}
                                isRequired
                                isDisabled={props.props.isBusy}
                                onValueChange={on.setBrief}
                            />
                            <div>
                                <Button
                                    variant="primary"
                                    isPending={props.props.isBusy}
                                    isDisabled={props.props.isSubmitDisabled}
                                    onPress={on.submit}
                                >
                                    {copy.submit}
                                </Button>
                            </div>
                            {props.props.isDrafting ? (
                                <Text size="sm" tone="muted" live="polite">
                                    {copy.drafting}
                                </Text>
                            ) : null}
                        </div>

                        <div aria-live="polite">
                            {failure === undefined ? null : (
                                <Alert title={copy.failedTitle} description={failure} tone="negative" />
                            )}
                            {result === undefined ? null : (
                                <SurfaceCard depth="nested">
                                    <div className={BODY_CLASS_NAME}>
                                        <Text weight="semibold">{result.title}</Text>
                                        <Text size="sm">{result.recipients}</Text>
                                        {result.time === "" ? null : (
                                            <Text size="xs" tone="muted">
                                                {result.time}
                                            </Text>
                                        )}
                                        <div className={QUOTE_CLASS_NAME}>
                                            <Text size="xs" tone="muted" weight="medium">
                                                {copy.draftLabel}
                                            </Text>
                                            <Text as="p" size="sm">
                                                {result.draft}
                                            </Text>
                                        </div>
                                    </div>
                                </SurfaceCard>
                            )}
                        </div>
                    </div>
                </SurfaceCard>
            ) : (
                <SurfaceCard ariaLabel={copy.title}>
                    <EmptyNotice message={copy.managersOnly} description={copy.managersOnlyBody} />
                </SurfaceCard>
            )}

            <SurfaceListCard
                label={copy.campaignsTitle}
                headingLevel={2}
                empty={<EmptyNotice message={copy.campaignsEmptyTitle} description={copy.campaignsEmptyBody} />}
            >
                {props.props.rows.map((row) => (
                    <ListItem key={row.id} className={ROW_CLASS_NAME}>
                        <div className={ROW_MAIN_CLASS_NAME}>
                            <div className={CHIPS_CLASS_NAME}>
                                <Text as="span" weight="semibold">
                                    {row.name}
                                </Text>
                                <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
                            </div>
                            <Text size="sm" tone="muted">
                                {row.counts}
                            </Text>
                            <Text size="xs" tone="muted">
                                {row.meta}
                            </Text>
                            {row.draft === "" ? null : (
                                <div className={QUOTE_CLASS_NAME}>
                                    <Text size="xs" tone="muted" weight="medium">
                                        {copy.draftLabel}
                                    </Text>
                                    <Text as="p" size="sm">
                                        {row.draft}
                                    </Text>
                                </div>
                            )}
                        </div>
                    </ListItem>
                ))}
            </SurfaceListCard>
        </>
    )
}
