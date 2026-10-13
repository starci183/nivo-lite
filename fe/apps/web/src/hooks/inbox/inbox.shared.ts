/** The words that explain a failed read or write: its own message, the fallback for a failure that has none, or nothing. */
export const errorMessage = (error: unknown, fallback?: string): string | undefined => {
    if (error instanceof Error) return error.message
    return error ? fallback : undefined
}
