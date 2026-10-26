import { Button, EmptyNotice, PageContainer, SurfaceCard } from "@starci/grammar/common"

/** The words of the lead-not-found page. */
export interface LeadNotFoundPageBaseProps {
    readonly props: {
        readonly ariaLabel: string
        readonly title: string
        readonly body: string
        readonly backLabel: string
        readonly backHref: string
    }
}

/** Shown when the lead id does not exist: one notice and the way back to the list. */
export const LeadNotFoundPageBase = (props: LeadNotFoundPageBaseProps) => (
    <PageContainer measure="reading">
        <SurfaceCard ariaLabel={props.props.ariaLabel}>
            <EmptyNotice message={props.props.title} description={props.props.body} />
            <Button intent="neutral" href={props.props.backHref}>
                {props.props.backLabel}
            </Button>
        </SurfaceCard>
    </PageContainer>
)
