/** The logging capability's options. */
export interface LoggingOptions {
    /** Where info lines go: stdout by default; a command line sends them to stderr so its stdout carries only its report. */
    readonly info?: "stdout" | "stderr"
}
