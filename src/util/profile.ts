﻿import fs from 'fs'
import path from 'path'

const profiler = require('v8-profiler-node8')

export const profile = (fn: Function) => {
  profiler.startProfiling()
  fn()
  const profile = profiler.stopProfiling()
  profile.export((err: any, result: any) => {
    const name = fn.name || 'anonymous'
    fs.writeFileSync(path.join(__dirname, '../..', `.profiles/${name}.cpuprofile`), result)
    profile.delete()
  })
}
