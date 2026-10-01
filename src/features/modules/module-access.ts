import type { ModuleDefinition } from './modules'

type ModuleActor = { isCrossBranch: boolean; permissions: string[] }

export function canAccessModule(module: ModuleDefinition, actor: ModuleActor) {
  return (
    actor.permissions.includes(module.permission) &&
    (module.group !== 'Management' || actor.isCrossBranch)
  )
}

export function isNavigationModule(module: ModuleDefinition) {
  return module.id !== 'driver-allowances'
}
