import { PageContainer, Text, TextAction } from "@starci/grammar/common"
import { BrainFactForm } from "@/components/blocks/BrainFactForm"
import { BrainFacts } from "@/components/blocks/BrainFacts"
import { BrainGaps } from "@/components/blocks/BrainGaps"
import { BrainLessons } from "@/components/blocks/BrainLessons"
import { BrainReview } from "@/components/blocks/BrainReview"
import { BrainStats } from "@/components/blocks/BrainStats"
import { PageHeading } from "@/components/composites/PageHeading"
import { PAGE_CLASS_NAME } from "./classNames"

/** Copy and values the Second Brain page supplies. */
export interface BrainPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly homeHref: string
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly documentsLabel: string
        readonly documentsHref: string
        /** What the address asks of the fact form: the fact being written, a fact to give a new value, a question to answer. */
        readonly fact: string | undefined
        readonly edit: string | undefined
        readonly answer: string | undefined
    }
}

/** Draws the Second Brain: its figures, what waits for review, the facts in force, the lessons and the questions nobody could answer. */
export const BrainPageBase = (props: BrainPageBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS_NAME}>
            <PageHeading
                crumbLabel={props.props.crumbLabel}
                crumbs={[
                    { id: "home", label: props.props.crumbHome, href: props.props.homeHref },
                    { id: "brain", label: props.props.title },
                ]}
                eyebrow={props.props.eyebrow}
                title={props.props.title}
                description={props.props.description}
            />
            <Text>
                <TextAction href={props.props.documentsHref}>{props.props.documentsLabel}</TextAction>
            </Text>
            <BrainStats />
            <BrainFactForm fact={props.props.fact} edit={props.props.edit} answer={props.props.answer} />
            <BrainReview />
            <BrainFacts />
            <BrainLessons />
            <BrainGaps />
        </div>
    </PageContainer>
)
