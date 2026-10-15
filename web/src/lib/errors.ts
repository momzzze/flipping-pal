import { ApiError } from './api'

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return `Rate limited by the Blizzard API. ${error.message}`
    return error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong'
}
