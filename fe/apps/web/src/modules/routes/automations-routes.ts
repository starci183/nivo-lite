import { AGENTS_ROUTE } from "./console-routes"

/** The pages an agent sends the owner to when something is missing, named once. */
export const AUTOMATION_ROUTES = {
    developers: "/developers",
    connections: "/connections",
    knowledge: "/brain?tab=sources",
    connectEmail: "/connections?connect=smtp",
} as const

/** The page of one agent type, where it is installed. */
export const newModulePath = (moduleKey: string): string => `${AGENTS_ROUTE}/${moduleKey}`
