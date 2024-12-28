import { type RootAction } from '../../../graph/index.js'
import { type Reducer } from '../../types.js'

// Counter

export const counterReducer: Reducer<CounterState, CounterAction> = (state, link) => {
  const action = link.body
  switch (action.type) {
    case 'ROOT': {
      return { value: 0 }
    }

    case 'INCREMENT': {
      const step = action.payload ?? 1
      return {
        ...state,
        value: state.value + step,
      }
    }

    default: {
      // ignore coverage
      return state
    }
  }
}
// state

export type CounterState = {
  value: number
}
// action types

export type CounterAction = IncrementAction

export type IncrementAction =
  | RootAction
  | {
      type: 'INCREMENT'
      payload: number
    }
