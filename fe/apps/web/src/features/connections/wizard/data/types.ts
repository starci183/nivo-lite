import type { AgentOption } from "../AgentStep"

/** Props every data-connector wizard takes (rendered inside the Connections drawer). */
export type DataWizardProps = {
  /** Workspace agents (any module): every agent may be given read access to a data source. */
  readonly agents: ReadonlyArray<AgentOption>
  /** Continue or edit this existing connection instead of creating a new one. */
  readonly resumeId?: string
  /** `changed` is true when something was saved, so the list refreshes. */
  readonly onClose: (changed: boolean) => void
}
