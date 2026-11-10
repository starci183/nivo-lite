import { Badge, Button, Heading, Mascot, Section, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { EffectOnMount } from "@starci/visual-effects/react"
import { CELEBRATION_CLASS_NAME, CELEBRATION_HERO_CLASS_NAME } from "./classNames"

/** Which 3D art the moment shows: the set-up check badge or the paid receipt. */
type CelebrationArt = "onboarding-done" | "payment-paid"

/** One fact of what was just done (the plan, the amount, the workspace). */
export interface CelebrationFact {
    readonly id: string
    readonly term: string
    readonly description: string
}

/** The one way on: a destination or a command. */
type CelebrationAction =
    | { readonly label: string; readonly href: string; readonly press?: never }
    | { readonly label: string; readonly press: () => void; readonly href?: never }

/** What the celebration says and offers next. */
interface CelebrationPanelProps {
    readonly art: CelebrationArt
    /** The short status mark over the heading (paid, ready). */
    readonly badge: string
    readonly heading: string
    readonly text: string
    readonly isLoading: boolean
    /** The facts of what was done, under their card label; none draws no card. */
    readonly factsLabel: string
    readonly facts: ReadonlyArray<CelebrationFact>
    /** The first things worth doing, each a row that opens its page; none draws no card. */
    readonly nextLabel: string
    readonly next: ReadonlyArray<ListRowData>
    readonly primary: CelebrationAction
}

/** Which art a celebration draws. */
interface CelebrationMascotProps {
    readonly art: CelebrationArt
}

/** The 3D art of one moment. */
const CelebrationMascot = (props: CelebrationMascotProps) =>
    props.art === "payment-paid" ? (
        <Mascot
            src="/images/promo/payment-paid-3d.webp"
            size="lg"
            loading="eager"
            assetSlot="payment-paid"
            assetSha256="b38a11c27a9166848ea64364efd4cd9b9c2369df8ac053c920f3d47321aaea3b"
            assetPrompt="A pure 3D paper receipt with a rose check badge on it and a few confetti pieces, soft clay render, no characters, transparent ground"
        />
    ) : (
        <Mascot
            src="/images/entry/onboarding-done-3d.webp"
            size="lg"
            loading="eager"
            assetSlot="onboarding-done"
            assetSha256="ca22f750eb5c5bdbaa6b6bab882a7d3a4fa4bb1321a61232ba1d533b08dd832e"
            assetPrompt="A large rose pure 3D check mark badge with rose and pink confetti and small golden stars, soft clay render, no characters, transparent ground"
        />
    )

/** The facts card, when there are facts. */
const FactsCard = (props: Pick<CelebrationPanelProps, "factsLabel" | "facts" | "isLoading">) =>
    props.facts.length === 0 ? null : (
        <SurfaceCard kind="details" label={props.factsLabel} headingLevel={2} items={props.facts} isLoading={props.isLoading} />
    )

/** The next-steps card, when there are next steps. */
const NextCard = (props: Pick<CelebrationPanelProps, "nextLabel" | "next">) =>
    props.next.length === 0 ? null : (
        <Section kind="list" title={props.nextLabel} headingLevel={2} items={props.next} empty={null} />
    )

/**
 * The moment a purchase or a set-up lands: confetti over the page once, the 3D art, the status mark, the heading and its line,
 * then what was done, what to do first, and the one way on.
 */
export const CelebrationPanel = (props: CelebrationPanelProps) => (
    <div className={CELEBRATION_CLASS_NAME}>
        {props.isLoading ? null : <EffectOnMount effect="confetti" preset="celebrate" />}
        <Stack gap="section">
            <div className={CELEBRATION_HERO_CLASS_NAME}>
                <Stack gap="row" align="center">
                    <CelebrationMascot art={props.art} />
                    <Badge tone="success" isDot>
                        {props.badge}
                    </Badge>
                    <Heading level={1} scale="title" isLoading={props.isLoading}>
                        {props.heading}
                    </Heading>
                    <Text tone="muted">{props.text}</Text>
                </Stack>
            </div>
            <FactsCard factsLabel={props.factsLabel} facts={props.facts} isLoading={props.isLoading} />
            <NextCard nextLabel={props.nextLabel} next={props.next} />
            {props.primary.href === undefined ? (
                <Button intent="commit" width="fill" onPress={props.primary.press}>
                    {props.primary.label}
                </Button>
            ) : (
                <Button endArrow intent="commit" width="fill" href={props.primary.href}>
                    {props.primary.label}
                </Button>
            )}
        </Stack>
    </div>
)
