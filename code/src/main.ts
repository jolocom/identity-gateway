import { AttributeChecker } from './attribute-checker';
require('source-map-support').install()
require('regenerator-runtime/runtime')
import * as _ from 'lodash'
import * as URL from 'url-parse'
import * as http from 'http'
import { spawnSync } from 'child_process'
import * as bluebird from 'bluebird'
import * as request from 'request-promise-native'
import * as Sequelize from 'sequelize'
import * as redis from 'redis'
const session = require('express-session')
const RedisStore = require('connect-redis')(session)
import { DataSigner } from './data-signer'
import { GatewayPrivateKeyGenerator, DummyGatewayPrivateKeyGenerator } from './private-key-generators'
import { GatewayIdentityCreator, EthereumIdentityCreator } from './identity-creators'
import { EthereumInteraction } from './ethereum-interaction'
import { AttributeVerifier } from './attribute-verifier'
import { MemoryVerificationStore, SequelizeVerificationStore } from './verification-store'
import { MemoryAttributeStore, SequelizeAttributeStore } from './attribute-store'
import { MemoryAccessRights, SequelizeAccessRights } from './access-rights'
import { MemoryGatewayIdentityStore, SequelizeGatewayIdentityStore } from './identity-store'
import WalletManager from 'smartwallet-contracts/lib/manager'
import Wallet from 'smartwallet-contracts/lib/wallet'
import { defineSequelizeModels } from './sequelize/models'
import { createApp, createSocketIO } from './app'
import * as openpgp from 'openpgp'
openpgp.initWorker({ path: '../node_modules/openpgp/dist/openpgp.worker.js' })


const DEVELOPMENT_MODE = process.env.NODE_ENV === 'dev';


export async function main() : Promise<any> {
  let config
  try {
    config = require('../config.json')
  } catch(e) {
    if (DEVELOPMENT_MODE) {
      config = {
        sessionSecret: 'dev session secret'
      }
    } else {
      throw e
    }
  }

  try {
    const sequelize = new Sequelize(process.env.DATABASE || 'sqlite://', {
      logging: process.env.LOG_SQL === 'true'
    })
    await sequelize.authenticate()

    const sequelizeModels = defineSequelizeModels(sequelize)
    if (DEVELOPMENT_MODE || process.env.SYNC === 'true') {
      await sequelize.sync()
    }

    let privateKeySize = DEVELOPMENT_MODE ? 512 : 2048
    if (process.env.PRIV_KEY_SIZE){
      privateKeySize = parseInt(process.env.PRIV_KEY_SIZE)
    }

    const identityUrlBuilder = ({userName, req}) => {
      if (DEVELOPMENT_MODE) {
        return `http://localhost:5678/${userName}`
      } else {
        return `https://identity.jolocom.com/${userName}`
      }
    }
    const identityStore = new SequelizeGatewayIdentityStore({
      identityModel: sequelizeModels.Identity,
      linkedIdentityModel: sequelizeModels.LinkedIdentity
    })
    const attributeStore = new SequelizeAttributeStore({
      attributeModel: sequelizeModels.Attribute
    })
    const publicKeyRetrievers = {
      url: async (identity) => {
        return JSON.parse((await request(identity))).publicKey
      },
      ethereum: async (identity, identityAddress) => {
        return await walletManager.getPublicKeyByUri({uri: identity, identityAddress})
      }
    }
    // const accessRights = new SequelizeAccessRights({
    //   ruleModel: sequelizeModels.Rule
    // })
    const accessRights = new MemoryAccessRights()
    const attributeRetriever = async ({sourceIdentitySignature, identity, attrType, attrId}) => {
      const cookieJar = request.jar()
      const req = request.defaults({jar: cookieJar})

      await req({
        method: 'POST',
        uri: new URL(identity).origin + '/login',
        form: {identity: sourceIdentitySignature.data, signature: sourceIdentitySignature.signature}
      })

      return (await req(`${identity}/identity/${attrType}/${attrId}`))
    }
    const verificationsRetriever = async ({sourceIdentitySignature, identity, attrType, attrId}) => {
      const cookieJar = request.jar()
      const req = request.defaults({jar: cookieJar})

      await req({
        method: 'POST',
        uri: new URL(identity).origin + '/login',
        form: {identity: sourceIdentitySignature.data, signature: sourceIdentitySignature.signature}
      })

      return _.map(JSON.parse(await req(`${identity}/identity/${attrType}/${attrId}/verifications`)),
        (verification, id) => {
          return {...verification, id}
        }
      )
    }
    const verificationSender = async ({
      sourceIdentitySignature, sourceLinkedIdentities,
      identity, attrType, attrId, signature
    }) => {
      const cookieJar = request.jar()
      const req = request.defaults({jar: cookieJar})
      await req({
        method: 'POST',
        uri: new URL(identity).origin + '/login',
        form: {identity: sourceIdentitySignature.data, signature: sourceIdentitySignature.signature}
      })
      await req({
        method: 'PUT',
        uri: `${identity}/identity/${attrType}/${attrId}/verifications`,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          linkedIdentities: sourceLinkedIdentities,
          signature: signature.signature
        })
      })
    }

    let expressSessionStore
    if (process.env.SESSION_BACKEND !== 'memory') {
      const redisClient = redis.createClient()
      expressSessionStore = new RedisStore({
        client: redisClient
      })
    } else {
      expressSessionStore = new session.MemoryStore()
    }

    let ethereumConfig = config.ethereum
    if (DEVELOPMENT_MODE) {
      if (!ethereumConfig) {
        ethereumConfig = {
          gethHost: 'http://localhost:8545'
        }
      }
      if (!ethereumConfig.lookupContractAddress) {
        ethereumConfig.lookupContractAddress = process.env.LOOKUP_CONTRACT_ADDRESS
      }
    }
    if (!ethereumConfig.pin) {
      ethereumConfig.pin = '1111'
    }
    ethereumConfig.debug = process.env.DEBUG_CONTRACTS_LIB === 'true'

    const walletManager = new WalletManager(ethereumConfig)
    if (DEVELOPMENT_MODE && !ethereumConfig.lookupContractAddress) {
      await walletManager.setupTestRPC({
        seedPhrase: 'mandate print cereal style toilet hole cave mom heavy fork network indoor'
      })
      console.log(
        'Deployed test contracts! LookupContract:', 
        walletManager._config.lookupContractAddress
      )
    }

    const ethereumInteraction = new EthereumInteraction({walletManager})
    const ethereumIdentityCreator = new EthereumIdentityCreator({walletManager, identityStore})
    const getEthereumAccountByUserId = async (userId : string) => {
      const linkedIdentities = await identityStore.getLinkedIdentities({userId})
      return {
        walletAddress: linkedIdentities['ethereum:wallet'],
        identityAddress: linkedIdentities['ethereum:identity'],
      }
    }
    const getEthereumAccountByUri = async (uri : string) : Promise<{identityAddress, publicKey}> => {
      return await walletManager.getAccountInfoByUri({uri})
    }

    const verificationStore = new SequelizeVerificationStore({
      attributeModel: sequelizeModels.Attribute,
      verificationModel: sequelizeModels.Verification,
      attributeStore, publicKeyRetrievers,
      getEthereumAccountByUri
    })

    const app = createApp({
      accessRights,
      sessionSecret: config.sessionSecret,
      expressSessionStore,
      identityUrlBuilder,
      identityStore: identityStore,
      attributeStore,
      publicKeyRetrievers,
      verificationStore,
      identityCreator: new GatewayIdentityCreator({
        identityStore,
        // privateKeyGenerator: new DummyGatewayPrivateKeyGenerator(),
        privateKeyGenerator: new GatewayPrivateKeyGenerator({privateKeySize}),
      }),
      ethereumIdentityCreator,
      ethereumInteraction,
      attributeVerifier: new AttributeVerifier({
        dataSigner: new DataSigner({identityStore}),
        attributeRetriever,
        verificationSender,
        identityStore
      }),
      attributeChecker: new AttributeChecker({
        dataSigner: new DataSigner({identityStore}),
        publicKeyRetrievers,
        attributeRetriever,
        verificationsRetriever
      }),
      getEthereumAccountByUserId
    })

    const server = http.createServer(app)
    await new Promise((resolve, reject) => {
      server.listen(parseInt(process.env.IDENTITY_PORT) || 5678, (err) => {
        if (err) { return reject(err) }
        resolve(server)
      })
    })

    const io = createSocketIO({
      server,
      sessionSecret: config.sessionSecret,
      sessionStore: expressSessionStore,
      verificationStore,
    })

    if (DEVELOPMENT_MODE) {
      await devPostInit()
    }

    return server
  } catch (e) {
    console.error(e)
    console.trace()
  }
}

async function devPostInit() {
  try {
    const logStep = (msg) => {
      console.log('= DEV POST INIT:', msg, '=')
    }

    logStep('Start')

    const gatewayURL = 'http://localhost:' + (process.env.IDENTITY_PORT || '5678')
    const testEthereumIdentity = process.env.TEST_ETHEREUM_IDENTITY === 'true'
    const testAttributeVerification = process.env.TEST_ATTRIBUTE_VERIFICATION === 'true'
    const firstUser = {
      userName: process.env.FIRST_USER_NAME || 'joe',
      seedPhrase: process.env.FIRST_USER_SEED_PHRASE || (
        testEthereumIdentity
        ? 'mandate print cereal style toilet hole cave mom heavy fork network indoor'
        : 'user1 seed phrase'
      )
    }
    const createSecondUser = testAttributeVerification ||
      process.env.SECOND_USER_SEED_PHRASE ||
      process.env.CREATE_SECOND_USER === 'true'
    const secondUser = {
      create: createSecondUser,
      userName: process.env.SECOND_USER_NAME || 'jane',
      seedPhrase: process.env.SECOND_USER_SEED_PHRASE || (
        testEthereumIdentity
        ? 'acquire coyote coyote polar unhappy piano twelve great infant creek brief today'
        : 'user2 seed phrase'
      )
    }
    
    const cookieJar_1 = request.jar()
    const session_1 = request.defaults({jar: cookieJar_1})
    const cookieJar_2 = request.jar()
    const session_2 = request.defaults({jar: cookieJar_2})
    
    logStep('Creating first user')

    await session_1({
      method: 'PUT',
      uri: `${gatewayURL}/${firstUser.userName}`,
      form: {seedPhrase: firstUser.seedPhrase}
    })

    logStep('Logging in first user')

    await session_1({
      method: 'POST',
      uri: gatewayURL + '/login',
      form: {seedPhrase: firstUser.seedPhrase}
    })

    if (secondUser.create) {
      logStep('Creating second user')

      await session_2({
        method: 'PUT',
        uri: `${gatewayURL}/${secondUser.userName}`,
        form: {seedPhrase: secondUser.seedPhrase}
      })

      logStep('Logging in second user')

      await session_2({
        method: 'POST',
        uri: gatewayURL + '/login',
        form: {seedPhrase: secondUser.seedPhrase}
      })
    }

    if (testEthereumIdentity) {
      logStep('Creating Ethereum identity for second user')

      await session_2({
        method: 'POST',
        uri: `${gatewayURL}/${secondUser.userName}/ethereum/create-identity`,
        form: {seedPhrase: secondUser.seedPhrase}
      })

      logStep('Getting Ethereum identity info for first user')

      let ethereumInfo = await session_2({
        method: 'GET',
        uri: `${gatewayURL}/${secondUser.userName}/ethereum`,
        form: {seedPhrase: secondUser.seedPhrase}
      })
      if (typeof ethereumInfo === 'string') {
        ethereumInfo = JSON.parse(ethereumInfo)
      }

      console.log('Ethereum identity info', ethereumInfo)

      console.log('Ethereum balance:', await session_2({
        method: 'POST',
        uri: `${gatewayURL}/${secondUser.userName}/ethereum/get-balance`,
        form: {walletAddress: ethereumInfo.walletAddress}
      }))
    }

    if (testAttributeVerification) {
      logStep('Storing e-mail attribute')

      await session_1({
        method: 'PUT',
        uri: `${gatewayURL}/${firstUser.userName}/identity/email/primary`,
        body: '[["value","vincent@shishkabab.net"]]',
        headers: {'Content-Type': 'application/json'}
      })

      logStep('Retrieving e-mail attribute')

      console.log('Stored email attribute', await session_1({
        method: 'GET',
        uri: `${gatewayURL}/${firstUser.userName}/identity/email/primary`,
      }))

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

      logStep('Verifying e-mail attribute')

      await session_2({
        method: 'POST',
        uri: `${gatewayURL}/${secondUser.userName}/verify`,
        form: {
          identity: `${gatewayURL}/${firstUser.userName}`,
          seedPhrase: secondUser.seedPhrase,
          attributeType: 'email',
          attributeId: 'primary',
          attributeValue: '[["value","vincent@shishkabab.net"]]'
        }
      })

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
          attributeValue: '[["value","vincent@shishkabab.net"]]'
        }
      }))
    }

    logStep('Finished')
  } catch (e) {
    console.error(e)
    console.trace()
  }
}

if(require.main === module){
  main()
}

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: ', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});
