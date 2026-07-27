export function createNotImplementedProvider(name) {
  return {
    id: name,
    async extract() {
      const err = new Error(`${name} 适配器尚未实现`)
      err.code = 'NOT_IMPLEMENTED'
      throw err
    },
    async execute() {
      const err = new Error(`${name} 适配器尚未实现`)
      err.code = 'NOT_IMPLEMENTED'
      throw err
    },
    async cancel() {
      return false
    },
  }
}
