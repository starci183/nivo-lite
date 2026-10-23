import type { ReactNode } from "react"
import { Alert, Region, SectionHeader } from "@starci/grammar/common"
import { SECTION_CLASS_NAME } from "./classNames"

/** What a team section draws around its content. */
type TeamSectionProps = {
    /** Names the heading, which names the region. */
    readonly id: string
    readonly title: string
    readonly description?: string | undefined
    /** Title of the negative alert. */
    readonly failTitle: string
    /** The failure text; nothing is drawn for it while undefined. */
    readonly error?: string | undefined
    readonly children: ReactNode
}

/** A named region of the team page: a level-2 heading, the one failure alert, then the section's own content. */
export const TeamSection = (props: TeamSectionProps) => (
    <Region labelledBy={props.id} className={SECTION_CLASS_NAME}>
        <SectionHeader id={props.id} level={2} title={props.title} description={props.description} />
        {props.error === undefined ? null : <Alert tone="negative" title={props.failTitle} description={props.error} />}
        {props.children}
    </Region>
)
