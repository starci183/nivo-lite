import { Grid, Section } from "@starci/grammar/common"
import { LandingFaqColumn } from "@/components/composites/LandingFaqColumn"
import { ANCHOR } from "./classNames"

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
    <div id="faq" className={ANCHOR}>
        <Section title={props.props.title} caption={props.props.eyebrow}>
            <Grid kind="cards" columns={2}>
                <LandingFaqColumn
                    label={props.props.leftLabel}
                    entries={props.props.left}
                    defaultOpenId={props.props.openFirstId}
                />
                <LandingFaqColumn label={props.props.rightLabel} entries={props.props.right} />
            </Grid>
        </Section>
    </div>
)
