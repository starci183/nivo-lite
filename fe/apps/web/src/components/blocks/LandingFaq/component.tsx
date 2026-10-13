import { PageContainer, Region, SectionHeader } from "@starci/grammar/common"
import { LandingFaqColumn } from "@/components/composites/LandingFaqColumn"
import { ANCHOR, FAQ_GRID, SECTION_STACK } from "./classNames"

/** One question with its answer. */
interface LandingFaqEntry {
    readonly id: string
    readonly question: string
    readonly answer: string
}

/** The resolved words the FAQ section draws. */
interface LandingFaqBaseProps {
    readonly props: {
        readonly regionLabel: string
        readonly eyebrow: string
        readonly title: string
        readonly leftLabel: string
        readonly rightLabel: string
        readonly left: ReadonlyArray<LandingFaqEntry>
        readonly right: ReadonlyArray<LandingFaqEntry>
        readonly openFirstId: string
    }
}

/** Two-column FAQ with honest answers. */
export const LandingFaqBase = (props: LandingFaqBaseProps) => (
    <Region id="faq" label={props.props.regionLabel} className={ANCHOR}>
        <PageContainer measure="product">
            <div className={SECTION_STACK}>
                <SectionHeader eyebrow={props.props.eyebrow} title={props.props.title} />
                <div className={FAQ_GRID}>
                    <LandingFaqColumn
                        label={props.props.leftLabel}
                        entries={props.props.left}
                        defaultOpenId={props.props.openFirstId}
                    />
                    <LandingFaqColumn label={props.props.rightLabel} entries={props.props.right} />
                </div>
            </div>
        </PageContainer>
    </Region>
)
