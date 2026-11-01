import {
    Grid,
    Heading,
    PageContainer,
    Region,
    SectionHeader,
    Stack,
    SurfaceCard,
    Tabs,
    Text,
} from "@starci/grammar/common"
import { LandingBrowserFrame } from "@/components/composites/LandingBrowserFrame"
import { IconGlyph } from "@/components/leaves/Icon"
import { ANCHOR, PRODUCT_DESKTOP, PRODUCT_STACK } from "./classNames"

/** One screenshot of the product with its size. */
interface LandingProductShot {
    readonly src: string
    readonly alt: string
    readonly caption: string
    readonly width: number
    readonly height: number
}

/** One view of the product: its tab, headline, benefits and screenshot. */
interface LandingProductView {
    readonly id: string
    readonly tabLabel: string
    readonly title: string
    readonly bullets: ReadonlyArray<string>
    readonly shot: LandingProductShot
}

/** The resolved words and pictures the product section draws, and the view shown on wide screens. */
interface LandingProductBaseProps {
    readonly props: {
        readonly headingId: string
        readonly eyebrow: string
        readonly title: string
        readonly tabsLabel: string
        readonly selectedId: string
        readonly views: ReadonlyArray<LandingProductView>
    }
    readonly on: {
        readonly select: (id: string) => void
    }
}

/** The benefits of one view. */
interface BulletsProps {
    readonly items: ReadonlyArray<string>
}

/** The glyph in front of each benefit. */
const CHECK_ICON = { name: "complete", usage: "leading" } as const

/** The benefits of one view as a list with a check glyph each. */
const Bullets = (props: BulletsProps) => (
    <Stack gap="row">
        {props.items.map((item) => (
            <Text key={item} size="sm" startContent={<IconGlyph {...CHECK_ICON} />}>
                {item}
            </Text>
        ))}
    </Stack>
)

/** Five views of NIVO OS with a real screenshot and three benefits each: tabs on wide screens, a stack on phones. */
export const LandingProductBase = (props: LandingProductBaseProps) => {
    const current = props.props.views.find((view) => view.id === props.props.selectedId) ?? props.props.views[0]
    return (
        <Region id="product" labelledBy={props.props.headingId} className={ANCHOR}>
            <PageContainer measure="product">
                <Stack gap="section">
                    <SectionHeader id={props.props.headingId} eyebrow={props.props.eyebrow} title={props.props.title} />
                    {current === undefined ? null : (
                        <div className={PRODUCT_DESKTOP}>
                            <SurfaceCard>
                                <Stack gap="section">
                                    <Tabs
                                        label={props.props.tabsLabel}
                                        selectedKey={current.id}
                                        inset="none"
                                        labelVisibility="always"
                                        items={props.props.views.map((view) => ({ id: view.id, label: view.tabLabel }))}
                                        onSelect={(key) => props.on.select(String(key))}
                                    />
                                    <LandingBrowserFrame
                                        src={current.shot.src}
                                        alt={current.shot.alt}
                                        label={current.shot.caption}
                                        width={current.shot.width}
                                        height={current.shot.height}
                                    />
                                    <Grid kind="cards" columns={2}>
                                        <Heading level={3}>{current.title}</Heading>
                                        <Bullets items={current.bullets} />
                                    </Grid>
                                </Stack>
                            </SurfaceCard>
                        </div>
                    )}
                    <div className={PRODUCT_STACK}>
                        <Stack gap="region">
                            {props.props.views.map((view) => (
                                <Stack key={view.id} gap="section">
                                    <Text size="sm" tone="muted" weight="medium">
                                        {view.tabLabel}
                                    </Text>
                                    <LandingBrowserFrame
                                        src={view.shot.src}
                                        alt={view.shot.alt}
                                        label={view.shot.caption}
                                        width={view.shot.width}
                                        height={view.shot.height}
                                    />
                                    <Heading level={3}>{view.title}</Heading>
                                    <Bullets items={view.bullets} />
                                </Stack>
                            ))}
                        </Stack>
                    </div>
                </Stack>
            </PageContainer>
        </Region>
    )
}
