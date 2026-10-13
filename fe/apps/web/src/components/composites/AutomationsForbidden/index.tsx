import { Button, PageContainer, SectionHeader } from "@starci/grammar/common"
import { LINK_ROW_CLASS, PAGE_CLASS } from "./classNames"

/** What the friendly 403 says, already in the reader language. */
type AutomationsForbiddenProps = {
    readonly title: string
    readonly body: string
    readonly backLabel: string
    readonly backHref: string
}

/** The friendly 403 staff see instead of the automations board. */
export const AutomationsForbidden = (props: AutomationsForbiddenProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS}>
            <SectionHeader level={1} title={props.title} description={props.body} />
            <div className={LINK_ROW_CLASS}>
                <Button variant="secondary" href={props.backHref}>
                    {props.backLabel}
                </Button>
            </div>
        </div>
    </PageContainer>
)
