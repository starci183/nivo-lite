import type { BrainPageHeading } from "@/modules/types"
import { BrainAsk } from "@/components/blocks/BrainAsk"
import { BrainDossiers } from "@/components/blocks/BrainDossiers"
import { BrainFacts } from "@/components/blocks/BrainFacts"
import { BrainLessons } from "@/components/blocks/BrainLessons"
import { BrainDocuments } from "@/components/blocks/BrainDocuments"
import { BrainTodo } from "@/components/blocks/BrainTodo"
import { PublicBrain } from "@/components/blocks/PublicBrain"
import type { BrainTab } from "@/modules/routes"

/** Copy and values the Second Brain page supplies. */
export interface BrainPageBaseProps {
    readonly props: {
        /** The header without its tabs: the frame adds them. */
        readonly header: BrainPageHeading
        /** The tab the address asks for. */
        readonly tab: BrainTab
        /** What the address asks of the fact form: the fact being written, a fact to give a new value, a question to answer. */
        readonly fact: string | undefined
        readonly edit: string | undefined
        readonly answer: string | undefined
        /** The lesson form the address asks for: `new` opens the drawer that writes a lesson. */
        readonly lesson: string | undefined
        /** The dossier open in the dossiers tab, the finding in view and the draft in the drawer. */
        readonly dossier: string | undefined
        readonly finding: string | undefined
        readonly draft: string | undefined
        /** The node selected on the map. */
        readonly node: string | undefined
        /** The public document form the address asks for. */
        readonly compose: "pick" | "write" | undefined
        /** The title the written form starts with: the customer question being answered. */
        readonly composeTitle: string
        /** The public document open as a draft. */
        readonly publicDoc: string | undefined
    }
}

/**
 * Draws the Second Brain: its four tabs on the header band, then the page the address asks for. The to-do inbox; the knowledge tab with
 * its chips (the documents and the facts as tables, the dossiers, the map and the lessons as panes pages with the chips across the
 * top); the public documents and the questions; the try.
 */
export const BrainPageBase = (props: BrainPageBaseProps) => {
    const page = props.props
    if (page.tab === "publicDocs" || page.tab === "publicAsks") {
        return (
            <PublicBrain
                key={page.composeTitle}
                heading={page.header}
                doc={page.publicDoc}
                compose={page.compose}
                composeTitle={page.composeTitle}
            />
        )
    }
    if (page.tab === "publicTry" || page.tab === "agents") return <BrainAsk heading={page.header} />
    if (page.tab === "sources") {
        return (
            <BrainDocuments header={page.header} />
        )
    }
    if (page.tab === "todo") {
        return <BrainTodo header={page.header} fact={page.fact} edit={page.edit} answer={page.answer} />
    }
    if (page.tab === "facts") {
        return <BrainFacts header={page.header} fact={page.fact} edit={page.edit} answer={page.answer} />
    }
    if (page.tab === "lessons") return <BrainLessons header={page.header} lesson={page.lesson} />
    if (page.tab === "dossiers") {
        return (
            <BrainDossiers
                header={page.header}
                mode="list"
                node={undefined}
                dossier={page.dossier}
                finding={page.finding}
                draft={page.draft}
            />
        )
    }
    return (
        <BrainDossiers
            header={page.header}
            mode="map"
            node={page.node}
            dossier={undefined}
            finding={undefined}
            draft={undefined}
        />
    )
}
