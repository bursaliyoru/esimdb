// Read at request time on the server, so the same Docker image works for any domain.
export const site = {
  get name() {
    return process.env.SITE_NAME || 'eSIM Compare'
  },
  get url() {
    return (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
  },
}
