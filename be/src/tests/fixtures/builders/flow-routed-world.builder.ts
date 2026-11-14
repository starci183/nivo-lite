import { workflowWorldOf, type ModuleName, type WorkflowWorld } from "./workflow-world.builder"

// The routed worlds of the graphs: one agent per module, its workflows seeded from the templates behind the real routing. Phase 3
// (package X1): the old engine's drive of a routed run (`driveRouted`) is gone; a routed run is driven on a thread only.

/** The agent of a module in the routed worlds. */
export const agentOf = (module: ModuleName): string => `${module}-agent`

/** The workflows of one agent per module (chatbot, sales), seeded from the templates behind the real routing. */
export const routedWorkflowsOf = (): WorkflowWorld =>
    workflowWorldOf({ [agentOf("chatbot")]: "chatbot", [agentOf("sales")]: "sales" })
