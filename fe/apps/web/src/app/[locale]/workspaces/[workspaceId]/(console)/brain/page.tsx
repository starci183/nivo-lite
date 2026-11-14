import type { ReactElement } from "react"
import { BrainPage } from "@/features/pages/BrainPage"

export { brainMetadata as generateMetadata } from "@/features/pages/BrainPage"

/** Always fresh: proposals arrive from agents and connectors at any time. */
export const dynamic = "force-dynamic"

/**
 * What the address may ask for: the tab, the fact form (a new fact, a fact in force or a customer question), the lesson form and the public document
 * forms (the picker, the written form with a title, a draft). The documents tab keeps its own keys (the agent, the filter, the search
 * text, the drawer that adds documents) in the address and reads them in the browser; an old address keeps them when it is forwarded.
 */
interface BrainSearch {
    readonly [key: string]: string | ReadonlyArray<string> | undefined
    readonly tab?: string
    readonly view?: string
    readonly fact?: string
    readonly edit?: string
    readonly answer?: string
    readonly lesson?: string
    readonly compose?: string
    readonly title?: string
    readonly doc?: string
    readonly policy?: string
}

/** What the page receives from Next. */
interface BrainRouteProps {
    readonly params: Promise<{ readonly workspaceId: string }>
    readonly searchParams: Promise<BrainSearch>
}

/** The first value of each parameter of the address. */
const paramsOf = (search: BrainSearch): Readonly<Record<string, string | undefined>> =>
    Object.fromEntries(
        Object.entries(search).map(([key, value]) => [key, typeof value === "string" ? value : value?.[0]]),
    )

/** The Second Brain: the shared memory of the business, its documents and what each agent sees of it. Everyone reads; owners and managers decide. */
const Page = async ({ params, searchParams }: BrainRouteProps): Promise<ReactElement> => {
    const { workspaceId } = await params
    const search = await searchParams
    const { tab, view, fact, edit, answer, lesson, compose, title, doc, policy } = search
    return (
        <BrainPage
            workspaceId={workspaceId}
            tab={tab}
            view={view}
            params={paramsOf(search)}
            fact={fact}
            edit={edit}
            answer={answer}
            lesson={lesson}
            compose={compose}
            title={title}
            doc={doc}
            policy={policy}
        />
    )
}

export default Page
