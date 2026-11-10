/** The pages an agent sends the owner to when something is missing, named once. */
export const AUTOMATION_ROUTES = {
    developers: "/developers",
    connections: "/connections",
    knowledge: "/brain?tab=knowledge&view=documents",
    connectEmail: "/connections?connect=smtp",
} as const
