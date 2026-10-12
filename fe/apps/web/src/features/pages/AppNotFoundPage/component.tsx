import { Button, Heading, PageContainer, SurfaceCard, Text } from "@starci/grammar/common"

/** Props for the pure not-found page. */
export type AppNotFoundPageBaseProps = {
    readonly props: {
        readonly title: string
        readonly text: string
        readonly homeLabel: string
        readonly homeHref: string
    }
}

/** Draws the unknown-route page. */
export const AppNotFoundPageBase = (props: AppNotFoundPageBaseProps) => (
    <PageContainer measure="reading">
        <SurfaceCard ariaLabel={props.props.title}>
            <Heading level={1}>{props.props.title}</Heading>
            <Text tone="muted">{props.props.text}</Text>
            <Button variant="secondary" href={props.props.homeHref}>
                {props.props.homeLabel}
            </Button>
        </SurfaceCard>
    </PageContainer>
)
