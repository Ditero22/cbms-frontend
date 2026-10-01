import { useContext } from 'react'
import { ModuleRuntimeContext } from './ModuleRuntimeContext'

export function useModuleRuntime() {
  const runtime = useContext(ModuleRuntimeContext)
  if (!runtime) {
    throw new Error('Module pages must be rendered inside the application shell.')
  }

  return runtime
}
