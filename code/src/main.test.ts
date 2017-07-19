import { expect } from 'chai'
import { main } from './main'

describe('Entry point', () => {
  it('should be able to start', async () => {
    const server = await main()
    await new Promise((resolve) => {
      server.close((err) => {
        resolve()
      })
    })
  })
})
