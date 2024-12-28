import { Store } from './Store.js'
import { type StoreOptions } from './StoreOptions.js'
import { type Action } from '../graph/index.js'

export const createStore = <S, A extends Action, C>(options: StoreOptions<S, A, C>) => {
  return new Store(options)
}
