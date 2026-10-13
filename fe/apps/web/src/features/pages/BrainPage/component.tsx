import { PageContainer, Text, TextAction } from "@starci/grammar/common"
import { BrainFactForm } from "@/components/blocks/BrainFactForm"
import { BrainFacts } from "@/components/blocks/BrainFacts"
import { BrainGaps } from "@/components/blocks/BrainGaps"
import { BrainLessons } from "@/components/blocks/BrainLessons"
import { BrainReview } from "@/components/blocks/BrainReview"
import { BrainStats } from "@/components/blocks/BrainStats"
import { PageHeading } from "@/components/composites/PageHeading"
import type { BrainFigures, FactPreset } from "@/hooks/brain"
import type { BrainFact, BrainGap, BrainLens, BrainLesson } from "@/modules/types"
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
        readonly workspaceId: string
        readonly canWrite: boolean
        readonly figures: BrainFigures
        readonly facts: ReadonlyArray<BrainFact>
        readonly lessons: ReadonlyArray<BrainLesson>
        readonly gaps: ReadonlyArray<BrainGap>
        readonly lenses: ReadonlyArray<BrainLens>
        /** The moment the page was read, in milliseconds. */
        readonly nowMs: number
        readonly isMaintenanceDue: boolean
        /** Whether the address asks for the fact form to be open, what it edits and what it was opened from. */
        readonly isFormOpen: boolean
        readonly formKey: string
        readonly editing: BrainFact | null
        readonly preset: FactPreset | undefined
        /** The same page while its data loads: headings and labels stay, figures and lists are skeletons. */
        readonly isLoading: boolean
    }
}

/** The trail of the page: home, then the Second Brain itself. */
const crumbsOf = (view: BrainPageBaseProps["props"]) => [
    { id: "home", label: view.crumbHome, href: view.homeHref },
    { id: "brain", label: view.title },
]

/** Draws the Second Brain: its figures, what waits for review, the facts in force, the lessons and the questions nobody could answer. */
export const BrainPageBase = (props: BrainPageBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS_NAME}>
            <PageHeading
                crumbLabel={props.props.crumbLabel}
                crumbs={crumbsOf(props.props)}
                eyebrow={props.props.eyebrow}
                title={props.props.title}
                description={props.props.description}
            />
            <Text>
                <TextAction href={props.props.documentsHref}>{props.props.documentsLabel}</TextAction>
            </Text>
            <BrainStats
                workspaceId={props.props.workspaceId}
                figures={props.props.figures}
                isMaintenanceDue={props.props.isMaintenanceDue}
                isLoading={props.props.isLoading}
            />
            {props.props.canWrite ? (
                <BrainFactForm
                    key={props.props.formKey}
                    workspaceId={props.props.workspaceId}
                    isOpen={props.props.isFormOpen}
                    editing={props.props.editing}
                    preset={props.props.preset}
                    lenses={props.props.lenses}
                />
            ) : null}
            <BrainReview
                workspaceId={props.props.workspaceId}
                facts={props.props.facts}
                nowMs={props.props.nowMs}
                canDecide={props.props.canWrite}
                isLoading={props.props.isLoading}
            />
            <BrainFacts
                workspaceId={props.props.workspaceId}
                facts={props.props.facts}
                canWrite={props.props.canWrite}
                isLoading={props.props.isLoading}
            />
            <BrainLessons
                workspaceId={props.props.workspaceId}
                lessons={props.props.lessons}
                lenses={props.props.lenses}
                canWrite={props.props.canWrite}
                isLoading={props.props.isLoading}
            />
            {props.props.canWrite ? (
                <BrainGaps
                    workspaceId={props.props.workspaceId}
                    gaps={props.props.gaps}
                    isLoading={props.props.isLoading}
                />
            ) : null}
        </div>
    </PageContainer>
)
