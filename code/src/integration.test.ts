import * as moment from 'moment'
import * as request from 'request-promise-native'
import { expect } from 'chai'
import { main } from './main'
import * as tests from './integration.tests'


describe('Integration test', function() {
  let server
  this.timeout(11000)

  before(async () => {
    process.env.DATABASE = 'sqlite://'
    server = await main({
      sessionSecret: 'test session secret',
      syncDB: true,
      baseUrl: 'http://localhost:5678',
      privKeySize: 512,
      ethereum: {testSetup: true}
    })
  })

  after(async () => {
    await server.close((err) => {
      console.log(err)
    })
  })

  it('should be able to do everything', async () => {
    await tests.devPostInit({
      testEthereumIdentity: true,
      testAttributeVerification: true
    })
  })
})
