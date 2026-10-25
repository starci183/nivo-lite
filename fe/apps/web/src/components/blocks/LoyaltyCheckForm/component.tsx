import {
    Alert,
    Badge,
    Button,
    DescriptionList,
    EmptyNotice,
    Form,
    Heading,
    Input,
    ListRow,
    SurfaceCard,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import { CARD_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** One reward the shop lists. */
export interface LoyaltyCheckReward {
    readonly id: string
    readonly name: string
    readonly detail: string
    readonly badge: string
    readonly canRedeem: boolean
}

/** What the visitor sees once the code is right. */
export interface LoyaltyCheckResult {
    readonly greeting: string
    readonly tierLabel: string
    readonly tierName: string
    readonly pointsLabel: string
    readonly points: string
    readonly nextTier?: string
    readonly expiring?: string
    readonly rewardsTitle: string
    readonly noRewards: string
    readonly redeemHint: string
    readonly rewards: ReadonlyArray<LoyaltyCheckReward>
}

/** Props for {@link LoyaltyCheckFormBase}. */
export interface LoyaltyCheckFormBaseProps {
    readonly props: {
        readonly status: "loading" | "missing" | "ready"
        readonly step: "phone" | "code" | "result"
        readonly title: string
        readonly lead: string
        readonly unavailable: string
        readonly loadingText: string
        readonly phone: {
            readonly label: string
            readonly placeholder: string
            readonly value: string
            readonly send: string
        }
        readonly code: {
            readonly label: string
            readonly value: string
            readonly check: string
            readonly sentTitle: string
            readonly sentBody: string
            readonly resend: string
        }
        readonly back: string
        readonly error?: string
        readonly isBusy: boolean
        readonly result?: LoyaltyCheckResult
    }
    readonly on: {
        readonly setPhone: (value: string) => void
        readonly setCode: (value: string) => void
        readonly sendCode: () => void
        readonly check: () => void
        readonly back: () => void
    }
}

/** Draws the public points check: phone, then the code sent to the customer's own chat, then their points. Shows nothing about a number before the code is right. */
export const LoyaltyCheckFormBase = (props: LoyaltyCheckFormBaseProps) => {
    const { status, step, title, result, error, isBusy } = props.props
    const on = props.on
    if (status === "loading")
        return (
            <SurfaceCard ariaLabel={title}>
                <Text tone="muted" live="polite">
                    {props.props.loadingText}
                </Text>
            </SurfaceCard>
        )
    if (status === "missing")
        return (
            <SurfaceCard ariaLabel={title}>
                <EmptyNotice message={props.props.unavailable} />
            </SurfaceCard>
        )
    if (step === "result" && result !== undefined) return renderGreeting(props)
    return (
        <SurfaceCard ariaLabel={title}>
            <div className={CARD_CLASS_NAME}>
                <Heading level={1} scale="standard">
                    {title}
                </Heading>
                {step === "phone" ? (
                    <>
                        <Text tone="muted">{props.props.lead}</Text>
                        <Form label={title} onSubmit={on.sendCode} isPending={isBusy}>
                            <div className={FORM_CLASS_NAME}>
                                <Input
                                    id="loyalty-phone"
                                    name="phone"
                                    label={props.props.phone.label}
                                    placeholder={props.props.phone.placeholder}
                                    isRequired
                                    isDisabled={isBusy}
                                    value={props.props.phone.value}
                                    onValueChange={on.setPhone}
                                />
                                <Button intent="commit" width="fill" type="submit" isPending={isBusy}>
                                    {props.props.phone.send}
                                </Button>
                            </div>
                        </Form>
                    </>
                ) : (
                    renderVerificationCode(props)
                )}
                {error === undefined ? null : <Alert tone="negative" title={error} />}
            </div>
        </SurfaceCard>
    )
}

/** Draws the greeting section of the current view. */
const renderGreeting = (props: LoyaltyCheckFormBaseProps) => {
    const { result } = props.props
    const on = props.on
    if (result === undefined) return null
    return (
        <SurfaceCard ariaLabel={result.greeting}>
            <div className={CARD_CLASS_NAME}>
                <Heading level={2} scale="standard">
                    {result.greeting}
                </Heading>
                <DescriptionList
                    layout="stat-strip"
                    isDivided
                    items={[
                        { id: "tier", term: result.tierLabel, description: result.tierName },
                        { id: "points", term: result.pointsLabel, description: result.points },
                    ]}
                />
                {result.nextTier === undefined ? null : (
                    <Text size="sm" tone="muted">
                        {result.nextTier}
                    </Text>
                )}
                {result.expiring === undefined ? null : <Alert tone="affirmative" title={result.expiring} />}
                <SurfaceListCard
                    label={result.rewardsTitle}
                    headingLevel={3}
                    empty={<EmptyNotice message={result.noRewards} />}
                >
                    {result.rewards.map((reward) => (
                        <ListRow
                            key={reward.id}
                            title={reward.name}
                            description={reward.detail}
                            badges={<Badge tone={reward.canRedeem ? "success" : "neutral"}>{reward.badge}</Badge>}
                        />
                    ))}
                </SurfaceListCard>
                <Text size="sm" tone="muted">
                    {result.redeemHint}
                </Text>
                <Button intent="neutral" onPress={on.back}>
                    {props.props.back}
                </Button>
            </div>
        </SurfaceCard>
    )
}

/** Draws the LoyaltyCheckFormContent section of the current view. */
const renderVerificationCode = (props: LoyaltyCheckFormBaseProps) => {
    const { isBusy } = props.props
    const on = props.on
    return (
        <>
            <Alert tone="affirmative" title={props.props.code.sentTitle} description={props.props.code.sentBody} />
            <Form label={props.props.code.check} onSubmit={on.check} isPending={isBusy}>
                <div className={FORM_CLASS_NAME}>
                    <Input
                        id="loyalty-code"
                        name="code"
                        kind="code"
                        label={props.props.code.label}
                        isRequired
                        isDisabled={isBusy}
                        value={props.props.code.value}
                        onValueChange={on.setCode}
                    />
                    <Button intent="commit" width="fill" type="submit" isPending={isBusy}>
                        {props.props.code.check}
                    </Button>
                </div>
            </Form>
            <Button intent="neutral" isDisabled={isBusy} onPress={on.sendCode}>
                {props.props.code.resend}
            </Button>
            <Button intent="dismiss" isDisabled={isBusy} onPress={on.back}>
                {props.props.back}
            </Button>
        </>
    )
}
