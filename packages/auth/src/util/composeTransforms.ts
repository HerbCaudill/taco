import { type Transform } from '../team/types.js'

export const composeTransforms =
  (transforms: Transform[]): Transform =>
  state =>
    transforms.reduce((state, transform) => transform(state), state)
