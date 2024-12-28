import { type Reducer } from './types.js'
import { type Action } from '../graph/index.js'

export const compose =
  <S, A extends Action>(reducers: Array<Reducer<S, A>>): Reducer<S, A> =>
  (state, action) =>
    reducers.reduce((state, reducer) => reducer(state, action), state)
