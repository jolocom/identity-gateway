import * as moment from 'moment'
import * as request from 'request-promise-native'
import { expect } from 'chai'
import { main } from './main'
import * as tests from './integration.tests'


describe('Integration test', function() {
  let server

  this.timeout(5000)

  before(async () => {
    process.env.DATABASE = 'sqlite://'

    server = await main({
      sessionSecret: 'test session secret',
      syncDB: true,
      baseUrl: 'http://localhost:5678',
      privKeySize: 512,
      ethereum: {
        testSetup: true
      }
    })
  })

  after(async () => {
    await new Promise((resolve) => {
      server.close((err) => {
        resolve()
      })
    })
  })

  it('should be able to do everything', async () => {
    await tests.devPostInit({
      testEthereumIdentity: true,
      testAttributeVerification: true
    })

    // let res
    // const cookieJar = request.jar()
    // const req = request.defaults({jar: cookieJar})
    // await req({
    //   method: 'PUT',
    //   uri: 'http://localhost:' + server.address().port + '/peter',
    //   body: JSON.stringify({"seedPhrase": "boo bla cow"})
    // })
    // await req({
    //   method: 'POST',
    //   uri: 'http://localhost:' + server.address().port + '/login',
    //   body: JSON.stringify({"seedPhrase": "boo bla cow"})
    // })
    // await req({
    //   method: 'PUT',
    //   uri: 'http://localhost:' + server.address().port + '/peter/identity/email/primary',
    //   body: JSON.stringify({"value": "vincent@shishkabab.net"})
    // })
    // res = await req({
    //   method: 'GET',
    //   uri: 'http://localhost:' + server.address().port + '/peter/identity/email/primary',
    // })
    // console.log(res)
  })
})
