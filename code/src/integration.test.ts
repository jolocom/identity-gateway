import * as moment from 'moment'
import * as request from 'request-promise-native'
import { expect } from 'chai'
import { main } from './main'


describe('Integration test', async () => {
  console.log(1)
  // const server = await main()
  console.log(2)

  // after(async () => {
  //   console.log(3)
  //   await new Promise((resolve) => {
  //     server.close((err) => {
  //       resolve()
  //     })
  //   })
  //   console.log(4)
  // })

  it.only('should be able to do everything', async () => {
    console.log(5)
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
