// import * as moment from 'moment'
// import * as request from 'request-promise-native'
// import { expect } from 'chai'
// import { main } from './main'
// import * as tests from './integration.tests'
//
//
// describe('Registration invitation test', function() {
//   let server
//   this.timeout(5000)
//
//   beforeEach(async () => {
//     process.env.DATABASE = 'sqlite://'
//
//     server = await main({
//       sessionSecret: 'test session secret',
//       syncDB: true,
//       baseUrl: 'http://localhost:5678',
//       privKeySize: 512,
//       firstInviteCode: 'invite-1',
//       ethereum: {
//         testSetup: false
//       }
//     })
//   })
//
//   afterEach(async () => {
//     await server.close((err) => {
//       console.log(err)
//     })
//   })
//
//   it('should be able to accept and generate invite codes', async () => {
//     const gatewayURL = 'http://localhost:5678'
//     const session = request.defaults({jar: request.jar()})
//
//     await session({
//       method: 'PUT',
//       uri: `${gatewayURL}/peter`,
//       form: {
//         seedPhrase: 'user1 seed phrase',
//         overrideWalletAddress: '0xdeadbeef',
//         inviteCode: 'invite-1'
//       }
//     })
//
//     let invitationReuseSucceeded
//     try {
//       const result = await session({
//         method: 'PUT',
//         uri: `${gatewayURL}/joe`,
//         form: {
//           seedPhrase: 'joe seed phrase',
//           overrideWalletAddress: '0xdeadbeef',
//           inviteCode: 'invite-1'
//         }
//       })
//       invitationReuseSucceeded = true
//     } catch(e) {
//       invitationReuseSucceeded = false
//     }
//     expect(invitationReuseSucceeded).to.be.false
//
//     let unauthorizedInviteCreated
//     try {
//       await session({
//         method: 'POST',
//         uri: gatewayURL + '/registration/create-invite',
//         json: true
//       })
//       unauthorizedInviteCreated = true
//     } catch(e) {
//       unauthorizedInviteCreated = false
//     }
//     expect(unauthorizedInviteCreated).to.be.false
//
//     await session({
//       method: 'POST',
//       uri: gatewayURL + '/login',
//       form: {seedPhrase: 'user1 seed phrase'}
//     })
//
//     const result = await session({
//       method: 'POST',
//       uri: gatewayURL + '/registration/create-invite',
//       json: true
//     })
//
//     await session({
//       method: 'PUT',
//       uri: `${gatewayURL}/joe`,
//       form: {
//         seedPhrase: 'joe seed phrase',
//         overrideWalletAddress: '0xdeadbeef',
//         inviteCode: result.code
//       }
//     })
//   })
//
//   it('should refuse requests invalid or missing invite codes', async () => {
//     const gatewayURL = 'http://localhost:5678'
//     const session = request.defaults({jar: request.jar()})
//
//     let unauthorizedAccountCreated
//     try {
//       await session({
//         method: 'PUT',
//         uri: `${gatewayURL}/peter`,
//         form: {
//           seedPhrase: 'user1 seed phrase',
//           overrideWalletAddress: '0xdeadbeef'
//         }
//       })
//       unauthorizedAccountCreated = true
//     } catch(e) {
//       unauthorizedAccountCreated = false
//     }
//     expect(unauthorizedAccountCreated).to.be.false
//
//     unauthorizedAccountCreated
//     try {
//       await session({
//         // method: 'PUT',
//         uri: `${gatewayURL}/peter`,
//         form: {
//           seedPhrase: 'user1 seed phrase',
//           overrideWalletAddress: '0xdeadbeef'
//         }
//       })
//       unauthorizedAccountCreated = true
//     } catch(e) {
//       unauthorizedAccountCreated = false
//     }
//     expect(unauthorizedAccountCreated).to.be.false
//   })
// })
