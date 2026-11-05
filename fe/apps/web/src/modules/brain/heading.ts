import type { BrainPageHeading } from "@/modules/types"

/** The words and destination the heading of a Second Brain page is made of. */
interface BrainHeadingInput {
    readonly crumbLabel: string
    readonly crumbHome: string
    readonly homeHref: string
    readonly title: string
    readonly description: string
}

/** The heading of a Second Brain page: the trail (the console, then the Second Brain), its title and its line. */
export const brainHeadingOf = (input: BrainHeadingInput): BrainPageHeading => ({
    breadcrumbs: {
        label: input.crumbLabel,
        items: [
            { id: "home", label: input.crumbHome, href: input.homeHref },
            { id: "brain", label: input.title },
        ],
    },
    title: input.title,
    description: input.description,
})
