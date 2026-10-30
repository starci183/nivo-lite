import { builder } from "@starci/jest-preset"
import { bookingResourcesEntities } from "@modules/domain/booking-resources"

const [BookingResourceEntity] = bookingResourcesEntities
type BookingResourceEntity = InstanceType<typeof BookingResourceEntity>

const resourceRowOf = builder<BookingResourceEntity>({
    id: "r-0",
    workspaceId: "ws-1",
    name: "Room",
    kind: "room",
    capacity: 1,
    color: "#000000",
    active: true,
    staffId: null,
    sortOrder: 0,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
})

/** A named resource of the workspace. */
export const namedResourceRow = (id: string, name: string) => resourceRowOf({ id, name })

/** A resource linked to a staff member. */
export const staffResourceRow = (id: string, staffId: string) => resourceRowOf({ id, staffId })

/** A resource with the given capacity. */
export const capacityResourceRow = (capacity: number) => resourceRowOf({ capacity })
