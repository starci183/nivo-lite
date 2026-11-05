/** The index of the chosen tab; the first tab when none is chosen or the chosen id is no tab of the panel. */
export const selectedTabIndex = (tabs: ReadonlyArray<{ readonly id: string }>, chosen: string | null): number => {
    const index = tabs.findIndex((tab) => tab.id === chosen)
    return index === -1 ? 0 : index
}
