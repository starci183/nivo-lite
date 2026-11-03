import type { ReactElement } from "react"
import { BrainPage } from "@/features/pages/BrainPage"

export { brainMetadata as generateMetadata } from "@/features/pages/BrainPage"

/** Always fresh: proposals arrive from agents and connectors at any time. */
export const dynamic = "force-dynamic"

/** What the address may ask for: the tab, the fact form (a new fact, a fact in force or a customer question), the agent filter, the idea the add drawer opens on, and the public document forms (the picker, the written form with a title, a draft). */
interface BrainSearch {
    readonly tab?: string
    readonly fact?: string
    readonly edit?: string
    readonly answer?: string
    readonly module?: string
    readonly add?: string
    readonly topic?: string
    readonly tag?: string
    readonly dossier?: string
    readonly finding?: string
    readonly draft?: string
    readonly node?: string
    readonly compose?: string
    readonly title?: string
    readonly doc?: string
}

/** What the page receives from Next. */
interface BrainRouteProps {
    readonly searchParams: Promise<BrainSearch>
}

/** The Second Brain: the shared memory of the business, its documents and what each agent sees of it. Everyone reads; owners and managers decide. */
const Page = async ({ searchParams }: BrainRouteProps): Promise<ReactElement> => {
    const { tab, fact, edit, answer, module, add, topic, tag, dossier, finding, draft, node, compose, title, doc } =
        await searchParams
    return (
        <BrainPage
            tab={tab}
            fact={fact}
            edit={edit}
            answer={answer}
            module={module}
            add={add}
            topic={topic}
            tag={tag}
            dossier={dossier}
            finding={finding}
            draft={draft}
            node={node}
            compose={compose}
            title={title}
            doc={doc}
        />
    )
}

export default Page
