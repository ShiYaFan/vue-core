const queueJob = new Set()
const p = Promise.resolve()

let isFlushing = false
const flushJob = () => {
  if(isFlushing)return
  isFlushing = true
  p.then(() => {
    queueJob.forEach(func => func())
  }).finally(() => {
    isFlushing = false
  })
}