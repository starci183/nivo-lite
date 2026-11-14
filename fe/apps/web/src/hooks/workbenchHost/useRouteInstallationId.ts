"use client"

import { useParams } from "next/navigation"

/**
 * The installation the open route is the workbench of: the `[installation]` of `agents/[module]/[installation]/...`. An action of the
 * door stamps its records for that installation's agent, so a second agent of one module writes for itself. Absent on a route that is
 * not one agent's (a package template names its own `[installation]` without a module), which leaves the door to the module's oldest.
 */
export const useRouteInstallationId = (): string | undefined => {
    const { module, installation } = useParams<{ module?: string; installation?: string }>()
    return module === undefined ? undefined : installation
}
