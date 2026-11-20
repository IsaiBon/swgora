export interface CatalogActor {
  id: string
  email: string
  name: string
  role: string
  isAdmin: boolean
}

export interface RepuestoOwnerMeta {
  userId?: string
  email?: string
  name?: string
  role?: string
}

export interface RepuestoOwnerSource {
  created_by_user_id?: string
  created_by_email?: string
  created_by_name?: string
  created_by_role?: string
  especificaciones_tecnicas?: Record<string, unknown>
}

export function buildCatalogActorFromUser(
  user: { id?: string; email?: string; name?: string; role?: string } | null | undefined,
  isAdmin: boolean
): CatalogActor | null {
  if (!user) return null
  const id = String(user.id || '').trim()
  const email = String(user.email || '').trim().toLowerCase()
  if (!id && !email) return null
  return {
    id,
    email,
    name: String(user.name || user.email || 'Usuario').trim(),
    role: String(user.role || '').trim(),
    isAdmin: Boolean(isAdmin)
  }
}

function isRepuestoOwnerMeta(
  value: RepuestoOwnerSource | RepuestoOwnerMeta
): value is RepuestoOwnerMeta {
  return (
    'userId' in value ||
    'email' in value ||
    'name' in value ||
    'role' in value
  )
}

export function extractRepuestoOwner(
  part: RepuestoOwnerSource | null | undefined
): RepuestoOwnerMeta {
  if (!part) return {}
  const spec = (part.especificaciones_tecnicas || {}) as Record<string, unknown>
  const userId = String(part.created_by_user_id || spec.created_by_user_id || '').trim() || undefined
  const rawEmail = String(part.created_by_email || spec.created_by_email || '').trim().toLowerCase()
  const email = rawEmail || undefined
  const name = String(part.created_by_name || spec.created_by_name || '').trim() || undefined
  const role = String(part.created_by_role || spec.created_by_role || '').trim() || undefined
  return { userId, email, name, role }
}

export function canActorModifyRepuesto(
  partOrOwner: RepuestoOwnerSource | RepuestoOwnerMeta | null | undefined,
  actor: CatalogActor | null | undefined
): boolean {
  if (!actor || (!actor.id && !actor.email)) return false
  if (actor.isAdmin) return true
  if (!partOrOwner) return false

  const owner = isRepuestoOwnerMeta(partOrOwner)
    ? partOrOwner
    : extractRepuestoOwner(partOrOwner)

  if (!owner.userId && !owner.email) return false

  if (owner.userId && actor.id && owner.userId.trim() === actor.id.trim()) {
    return true
  }
  if (
    owner.email &&
    actor.email &&
    owner.email.trim().toLowerCase() === actor.email.trim().toLowerCase()
  ) {
    return true
  }
  return false
}

export function stampOwnerOnSpecs(
  spec: Record<string, unknown> | undefined,
  actor: CatalogActor | null | undefined
): Record<string, unknown> {
  const cleanSpec: Record<string, unknown> = { ...(spec || {}) }
  if (!actor || (!actor.id && !actor.email)) {
    return cleanSpec
  }
  if (actor.id) cleanSpec.created_by_user_id = actor.id
  else delete cleanSpec.created_by_user_id

  if (actor.email) cleanSpec.created_by_email = actor.email.trim().toLowerCase()
  else delete cleanSpec.created_by_email

  if (actor.name) cleanSpec.created_by_name = actor.name
  else delete cleanSpec.created_by_name

  if (actor.role) cleanSpec.created_by_role = actor.role
  else delete cleanSpec.created_by_role

  return cleanSpec
}

export function preserveOwnerOnSpecs(
  existingOwner: RepuestoOwnerMeta | null | undefined,
  nextSpec: Record<string, unknown> | undefined
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(nextSpec || {}) }
  if (!existingOwner) return merged

  if (existingOwner.userId) merged.created_by_user_id = existingOwner.userId
  if (existingOwner.email) merged.created_by_email = existingOwner.email.trim().toLowerCase()
  if (existingOwner.name) merged.created_by_name = existingOwner.name
  if (existingOwner.role) merged.created_by_role = existingOwner.role

  return merged
}
