/** Log events of the connection form. */
export enum ConnectionFieldsLogEvent {
    /** A person changed an account through the form: workspace, account, provider, the keys changed and whether it was renamed; never a value. */
    Updated = "connection-fields.updated",
    /** A person ran a declared action of an account: workspace, account, provider, the action and the input keys; never a value. */
    ActionRun = "connection-fields.action_run",
    /** At boot, once per provider whose form could put a secret on a page (that provider is disabled): provider and problem codes. */
    DeclarationRefused = "connection-fields.declaration_refused",
    /** A writer answered a secret key from an action: provider, action and the dropped keys; never a value. */
    SecretAnswerDropped = "connection-fields.secret_answer_dropped",
}
