export type ActionState = { error?: string; ok?: string }
export const initialState: ActionState = {}

/** Postgres exceptions raised by the schema's guards carry the useful message. */
export function toMessage(error: { message: string; details?: string | null } | null) {
  if (!error) return 'Something went wrong.'
  return error.message.replace(/^[a-z_]+ error: /i, '')
}
