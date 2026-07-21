const ORIGIN = 'https://projectbluefin.io'

export default {
  async fetch(request) {
    const incoming = new URL(request.url)
    const originUrl = new URL(incoming.pathname === '/' ? '/wolves/' : incoming.pathname, ORIGIN)
    originUrl.search = incoming.search

    return fetch(new Request(originUrl, request))
  },
}
