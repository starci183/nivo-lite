/** Reports a contract defect of a block (a bound path missing in ready data) to the page error handlers instead of drawing a blank block. */
export const reportDefect = (code: string, at: string): void => {
    if (typeof window === "undefined") return
    window.reportError(new RangeError(`${code} at ${at}`))
}
