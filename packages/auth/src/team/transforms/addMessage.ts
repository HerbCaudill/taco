import { type Transform } from '../types.js'

export const addMessage =
  (message: unknown): Transform =>
  state => ({
    ...state,
    messages: [...state.messages, message],
  })
