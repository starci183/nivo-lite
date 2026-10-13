/** The rows of `automation_commands` this capability reads. */
export interface CommandRow {
    /** The command. */
    readonly id: string
    /** The workspace the manager acts in. */
    readonly workspace_id: string
    /** What was asked: the shop's wording proposed, or a scheduled workflow run now. */
    readonly kind: "propose_body" | "run_now"
    /** The template the command is about. */
    readonly template_key: string
    /** The manager who asked; the commands run as them. */
    readonly created_by: string
}
