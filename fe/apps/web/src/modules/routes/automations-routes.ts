/** The pages the automations send the owner to when something is missing, named once. */
export const AUTOMATION_ROUTES = {
    developers: "/developers",
    connections: "/connections",
    knowledge: "/brain?tab=sources",
    connectEmail: "/connections?connect=smtp",
    decisions: "/decisions",
} as const

/** The page that installs one module agent. */
export const newModulePath = (moduleKey: string): string => `/modules/new?module=${moduleKey}`

/** The automations page with one card open. */
export const automationFocusPath = (templateKey: string): string => `/automations?focus=${templateKey}`
