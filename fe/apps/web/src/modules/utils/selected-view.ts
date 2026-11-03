/** The input of one panel controller of a workbench: it is active only while its own tab is the chosen one. */
export const whenSelected = <Input extends { readonly isActive: boolean; readonly selected: string }>(
    input: Input,
    tab: Input["selected"],
): Input => ({ ...input, isActive: input.isActive && input.selected === tab })
