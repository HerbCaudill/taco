import { type Reducer } from './types.js'
import { type Action, getSequence, type Graph, type Resolver } from '../graph/index.js'
import { validate, type ValidatorSet } from '../validator/index.js'

export const makeMachine = <S, A extends Action, C>({
  initialState,
  reducer,
  resolver,
  validators,
}: MachineParams<S, A, C>) => {
  return (graph: Graph<A, C>) => {
    // Validate the graph's integrity.
    validate(graph, validators)

    // Use the filter & sequencer to turn the graph into an ordered sequence
    const sequence = getSequence(graph, resolver)

    // Run the sequence through the reducer to calculate the current team state
    return sequence.reduce(reducer, initialState)
  }
}

type MachineParams<S, A extends Action, C> = {
  initialState: S
  reducer: Reducer<S, A, C>
  resolver: Resolver<A, C>
  validators?: ValidatorSet
}
