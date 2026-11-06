import type { BrainPageHeading } from "@/modules/types"

/** The words and destination the heading of a Second Brain page is made of. */
interface BrainHeadingInput {
    readonly crumbLabel: string
    readonly crumbHome: string
    /** Where the first crumb leads; none while the page only draws its skeleton (a loading boundary knows no workspace). */
    readonly homeHref?: string | undefined
    readonly title: string
    readonly description: string
}

/** The heading of a Second Brain page: the trail (the console, then the Second Brain), its title and its line. */
export const brainHeadingOf = (input: BrainHeadingInput): BrainPageHeading => ({
    breadcrumbs: {
        label: input.crumbLabel,
        items: [
            { id: "home", label: input.crumbHome, ...(input.homeHref === undefined ? {} : { href: input.homeHref }) },
            { id: "brain", label: input.title },
        ],
    },
    title: input.title,
    description: input.description,
})
