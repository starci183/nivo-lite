import { BrainPage } from "@/features/pages/BrainPage"

export { brainMetadata as generateMetadata } from "@/features/pages/BrainPage"

/** Always fresh: proposals arrive from agents and connectors at any time. */
export const dynamic = "force-dynamic"

/** What the address may ask for: the fact form, open on a new fact, on a fact in force or on a customer question. */
interface BrainSearch {
    readonly fact?: string
    readonly edit?: string
    readonly answer?: string
}

/** What the page receives from Next. */
interface BrainRouteProps {
    readonly searchParams: Promise<BrainSearch>
}

/** The Second Brain: the shared memory of the business. Everyone reads; owners and managers decide. */
const Page = async ({ searchParams }: BrainRouteProps) => {
    const { fact, edit, answer } = await searchParams
    return <BrainPage fact={fact} edit={edit} answer={answer} />
}

export default Page
