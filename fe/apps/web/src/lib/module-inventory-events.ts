/** Wave-3 shim: an order confirmed in the shop takes its goods out of stock through the back end deduct-order queue, not through this event hook. */
export const onInventoryEvent = async (
    _workspaceId: string,
    _event: string,
    _data: Readonly<Record<string, unknown>>,
): Promise<void> => undefined
