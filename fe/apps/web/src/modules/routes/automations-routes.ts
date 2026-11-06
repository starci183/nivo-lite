import { AGENTS_ROUTE } from "./console-routes"

/** The pages the automations send the owner to when something is missing, named once. */
export const AUTOMATION_ROUTES = {
    developers: "/developers",
    connections: "/connections",
    knowledge: "/brain?tab=sources",
    connectEmail: "/connections?connect=smtp",
    decisions: "/decisions",
} as const

/** The page of one agent type, where it is installed. */
export const newModulePath = (moduleKey: string): string => `${AGENTS_ROUTE}/${moduleKey}`

/** The automations page with one card open. */
export const automationFocusPath = (templateKey: string): string => `/automations?focus=${templateKey}`
