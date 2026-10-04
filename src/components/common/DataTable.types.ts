/** Presentation metadata only; navigation, permissions and mutations belong to features. */
export type DataTableDefinition = {
  id: string
  title: string
  columns: string[]
  mobileColumns?: string[]
  sortableColumns?: string[]
}
