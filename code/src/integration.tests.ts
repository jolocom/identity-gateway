import { expect } from 'chai';
import * as _ from 'lodash'
import * as request from 'request-promise-native'

export async function createIdentities({logStep, gatewayURL, sessions, users}) {
  for(let i = 0; i < users.length; ++i) {
    if (!users[i].create) {
      continue
    }
    users[i].index = i

    logStep('Creating user ' + (i + 1))

    await sessions[i]({
      method: 'PUT',
      uri: `${gatewayURL}/${users[i].userName}`,
      form: {
        seedPhrase: users[i].seedPhrase,
        overrideWalletAddress:
          users[i].seedPhrase.indexOf('seed phrase') > 0
          ? '0xdeadbeef'
          : undefined
      }
    })

    logStep('Logging in user ' + (i + 1))

    await sessions[i]({
      method: 'POST',
      uri: gatewayURL + '/login',
      form: {seedPhrase: users[i].seedPhrase}
    })

    let ethereumInfo = await sessions[i]({
      method: 'GET',
      uri: `${gatewayURL}/${users[i].userName}/ethereum`,
      form: {seedPhrase: users[i].seedPhrase}
    })
    if (typeof ethereumInfo === 'string') {
      ethereumInfo = JSON.parse(ethereumInfo)
    }

    console.log('Ethereum identity info for user ' + (i + 1), ethereumInfo)
  }
}

export async function createEthereumIdentity({logStep, gatewayURL, session, user}) {
  logStep('Creating Ethereum identity for user ' + (user.index + 1))

  await session({
    method: 'POST',
    uri: `${gatewayURL}/${user.userName}/ethereum/create-identity`,
    form: {seedPhrase: user.seedPhrase}
  })

  logStep('Getting Ethereum identity info for user ' + (user.index + 1))

  let ethereumInfo = await session({
    method: 'GET',
    uri: `${gatewayURL}/${user.userName}/ethereum`,
    form: {seedPhrase: user.seedPhrase}
  })
  if (typeof ethereumInfo === 'string') {
    ethereumInfo = JSON.parse(ethereumInfo)
  }
  console.log('Ethereum identity info', ethereumInfo)

  logStep('Testing separate Ethereum endpoints for user ' + (user.index + 1))

  expect(await session({
    method: 'GET',
    uri: `${gatewayURL}/${user.userName}/ethereum/wallet-address`,
  })).to.equal(ethereumInfo.walletAddress)
  
  expect(await session({
    method: 'GET',
    uri: `${gatewayURL}/${user.userName}/ethereum/identity-address`,
  })).to.equal(ethereumInfo.identityAddress)

  logStep('Testing Ethereum balance endpoint for user ' + (user.index + 1))

  console.log('Ethereum balance:', await session({
    method: 'POST',
    uri: `${gatewayURL}/${user.userName}/ethereum/get-balance`,
    form: {walletAddress: ethereumInfo.walletAddress}
  }))
}

export async function devPostInit(options = {}) {
  try {
    const logStep = (msg) => {
      console.log('= DEV POST INIT:', msg, '=')
    }
    const getOption = (key) => {
      return options[_.camelCase(key)] || process.env[_.snakeCase(key).toUpperCase()]
    }
    const getBooleanOption = (key) => {
      let option = getOption(key)
      if (typeof option === 'string') {
        option = option === 'true'
      }
      return option
    }
    
    logStep('Start')

    const gatewayURL = 'http://localhost:' + (getOption('IDENTITY_PORT') || '5678')
    const testEthereumIdentity = getBooleanOption('TEST_ETHEREUM_IDENTITY')
    const testAttributeVerification = getBooleanOption('TEST_ATTRIBUTE_VERIFICATION')
    const testAttributeCreation = testAttributeVerification || getBooleanOption('TEST_ATTRIBUTE_CREATION')
    const phoneAttribute = getOption('TEST_CREATE_PHONE_ATTRIBUTE')
    const firstUser = {
      create: true,
      userName: getOption('FIRST_USER_NAME') || 'joe',
      seedPhrase: getOption('FIRST_USER_SEED_PHRASE') || (
        testEthereumIdentity
        ? 'mandate print cereal style toilet hole cave mom heavy fork network indoor'
        : 'user1 seed phrase'
      )
    }

    const createSecondUser = testEthereumIdentity || testAttributeCreation ||
      getOption('SECOND_USER_SEED_PHRASE') ||
      getBooleanOption('CREATE_SECOND_USER')
    const secondUser = {
      create: createSecondUser,
      userName: getOption('SECOND_USER_NAME') || 'jane',
      seedPhrase: getOption('SECOND_USER_SEED_PHRASE') || (
        testEthereumIdentity
        ? 'acquire coyote coyote polar unhappy piano twelve great infant creek brief today'
        : 'user2 seed phrase'
      )
    }

    const createThirdUser = (getOption('SECOND_THIRD_SEED_PHRASE') ||
      getBooleanOption('CREATE_THIRD_USER'))
    const thirdUser = {
      create: createThirdUser,
      userName: getOption('THIRD_USER_NAME') || 'jack',
      seedPhrase: getOption('THIRD_USER_SEED_PHRASE') || 'user3 seed phrase'
    }

    const session_1 = request.defaults({jar: request.jar()})
    const session_2 = request.defaults({jar: request.jar()})
    const session_3 = request.defaults({jar: request.jar()})
    
    await createIdentities({
      users: [firstUser, secondUser, thirdUser],
      sessions: [session_1, session_2, session_3],
      gatewayURL,
      logStep
    })

    if (testEthereumIdentity) {
      await createEthereumIdentity({
        logStep, gatewayURL,
        session: session_2, user: secondUser
      })
    }

    if (testAttributeCreation) {
      logStep('Storing e-mail attribute')

      await session_1({
        method: 'PUT',
        uri: `${gatewayURL}/${firstUser.userName}/identity/email/primary`,
        body: {value: 'vincent@shishkabab.net'},
        json: true
      })

      logStep('Retrieving e-mail attribute')

      const storedEmail = await session_1({
        method: 'GET',
        uri: `${gatewayURL}/${firstUser.userName}/identity/email/primary`,
        json: true
      })
      console.log('Stored email attribute', storedEmail)
      expect(storedEmail).to.deep.equal({value: 'vincent@shishkabab.net'})

      logStep('Users should not have access to each others\' attribute unless explicit access is granted')
      const deniedAccessResponse : any = await new Promise((resolve, reject) => {
        session_2({
          method: 'GET',
          uri: `${gatewayURL}/${firstUser.userName}/identity/email/primary`,
          json: true,
          resolveWithFullResponse: true
        }).then(resolve, resolve).catch(reject)
      })
      expect(deniedAccessResponse.body).to.equal(undefined)
      expect(deniedAccessResponse.statusCode).to.equal(403)
      
      logStep('Granting access to e-mail attribute')

      await session_1({
        method: 'POST',
        uri: `${gatewayURL}/${firstUser.userName}/access/grant`,
        form: {
          identity: `${gatewayURL}/${secondUser.userName}`,
          pattern: '/identity/email/primary',
          read: 'true',
          write: 'false'
        },
      })

      logStep('Granting write access to e-mail attribute verifications')

      await session_1({
        method: 'POST',
        uri: `${gatewayURL}/${firstUser.userName}/access/grant`,
        form: {
          identity: `${gatewayURL}/${secondUser.userName}`,
          pattern: '/identity/email/primary/verifications',
          read: 'true',
          write: 'true'
        }
      })

      if (phoneAttribute && phoneAttribute !== 'false') {
        logStep('Storing phone attribute')

        await session_1({
          method: 'PUT',
          uri: `${gatewayURL}/${firstUser.userName}/identity/phone/primary`,
          body: {value: phoneAttribute !== 'true' ? phoneAttribute : '0049123456789', type: 'personal'},
          json: true
        })

        logStep('Retrieving phone attribute')

        console.log('Stored phone attribute', await session_1({
          method: 'GET',
          uri: `${gatewayURL}/${firstUser.userName}/identity/phone/primary`,
        }))

        logStep('Granting access to e-mail attribute')

        await session_1({
          method: 'POST',
          uri: `${gatewayURL}/${firstUser.userName}/access/grant`,
          form: {
            identity: `${gatewayURL}/${secondUser.userName}`,
            pattern: '/identity/phone/primary',
            read: 'true',
            write: 'false'
          },
        })

        logStep('Granting write access to phone attribute verifications')

        await session_1({
          method: 'POST',
          uri: `${gatewayURL}/${firstUser.userName}/access/grant`,
          form: {
            identity: `${gatewayURL}/${secondUser.userName}`,
            pattern: '/identity/phone/primary/verifications',
            read: 'true',
            write: 'true'
          }
        })
      }
    }

    if (testAttributeVerification) {
      logStep('Listing access rights')

      console.log('Access rights: ', await session_1({
        method: 'GET',
        uri: `${gatewayURL}/${firstUser.userName}/access`,
      }))

      logStep('Testing proxy functionality')

      console.log('Got e-mail via proxy', await session_2({
        method: 'GET',
        uri: `${gatewayURL}/proxy`,
        qs: {
          url: `${gatewayURL}/${firstUser.userName}/identity/email/primary`,
          seedPhrase: secondUser.seedPhrase
        }
      }))

      logStep('Verifying e-mail attribute')

      await session_2({
        method: 'POST',
        uri: `${gatewayURL}/${secondUser.userName}/verify`,
        form: {
          identity: `${gatewayURL}/${firstUser.userName}`,
          seedPhrase: secondUser.seedPhrase,
          attributeType: 'email',
          attributeId: 'primary',
          attributeValue: JSON.stringify({value: 'vincent@shishkabab.net'})
        }
      })

      logStep('Revoking write access to e-mail attribute verifications')

      await session_1({
        method: 'POST',
        uri: `${gatewayURL}/${firstUser.userName}/access/revoke`,
        form: {
          identity: `${gatewayURL}/${secondUser.userName}`,
          pattern: '/identity/email/primary/verifications',
          read: true,
          write: false
        }
      })

      logStep('Listing access rights')

      console.log('Access rights: ', await session_1({
        method: 'GET',
        uri: `${gatewayURL}/${firstUser.userName}/access`,
      }))

      logStep('Retrieving e-mail attribute verifications')

      console.log('Email attribute verifications', await session_1({
        method: 'GET',
        uri: `${gatewayURL}/${firstUser.userName}/identity/email/primary/verifications`,
      }))

      logStep('Checking e-mail attribute')

      console.log('Email attribute check result', await session_2({
        method: 'POST',
        uri: `${gatewayURL}/${secondUser.userName}/check`,
        form: {
          identity: `${gatewayURL}/${firstUser.userName}`,
          seedPhrase: secondUser.seedPhrase,
          attributeType: 'email',
          attributeId: 'primary',
          attributeValue: JSON.stringify({value: 'vincent@shishkabab.net'})
        }
      }))
    }

    logStep('Finished')
  } catch (e) {
    console.error(e)
    console.trace()
    throw e
  }
}
