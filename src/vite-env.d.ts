/// <reference types="vite/client" />

declare module '*.json' {
  const value: any
  export default value
}

declare module '*.txt?raw' {
  const value: string
  export default value
}
