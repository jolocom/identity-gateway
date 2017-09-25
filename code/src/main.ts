import { RandomCodeGenerator } from './code-generator';
import { SequelizeInviteStore } from './invite-store';
import { AttributeChecker } from './attribute-checker';
require('source-map-support').install()
require('regenerator-runtime/runtime')
import * as _ from 'lodash'
import * as URL from 'url-parse'
import * as path from 'path'
import * as http from 'http'
import { spawnSync } from 'child_process'
import * as bluebird from 'bluebird'
import * as request from 'request-promise-native'
import * as Sequelize from 'sequelize'
import * as redis from 'redis'
const session = require('express-session')
const RedisStore = require('connect-redis')(session)
import { initSequelize } from './sequelize/utils'
import { DataSigner } from './data-signer'
import { GatewayPrivateKeyGenerator, DummyGatewayPrivateKeyGenerator } from './private-key-generators'
import { GatewayIdentityCreator, EthereumIdentityCreator } from './identity-creators'
import EtherBalanceWatcher from './ether-balance-watcher'
import { EthereumInteraction } from './ethereum-interaction'
import { AttributeVerifier } from './attribute-verifier'
import { MemoryVerificationStore, SequelizeVerificationStore } from './verification-store'
import { MemoryAttributeStore, SequelizeAttributeStore } from './attribute-store'
import { MemoryAccessRights, SequelizeAccessRights } from './access-rights'
import { MemoryGatewayIdentityStore, SequelizeGatewayIdentityStore } from './identity-store'
import WalletManager from 'smartwallet-contracts/lib/manager'
import Wallet from 'smartwallet-contracts/lib/wallet'
import { createApp, createSocketIO } from './app'
import { devPostInit } from './integration.tests'
import * as openpgp from 'openpgp'
openpgp.initWorker({ path: '../node_modules/openpgp/dist/openpgp.worker.js' })


const DEVELOPMENT_MODE = process.env.NODE_ENV === 'dev';


export async function main(config = null) : Promise<any> {
  if (!config) {
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
  }

  try {
    const {sequelize, sequelizeModels} = await initSequelize({
      devMode: DEVELOPMENT_MODE
    })

    await sequelize.authenticate()
    if ((DEVELOPMENT_MODE && process.env.SYNC_DB !== 'false')
        || config.syncDB || process.env.SYNC_DB === 'true')
    {
      await sequelize.sync()
    }
    
    let privateKeySize = DEVELOPMENT_MODE ? 512 : 2048
    if (process.env.PRIV_KEY_SIZE){
      privateKeySize = parseInt(process.env.PRIV_KEY_SIZE)
    } else if (config.privKeySize) {
      privateKeySize = config.privKeySize
    }

    const identityUrlBuilder = ({userName, req}) => {
      if (config.baseUrl) {
        return `${config.baseUrl}/${userName}`
      } else if (DEVELOPMENT_MODE) {
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
    const accessRights = new SequelizeAccessRights({
      ruleModel: sequelizeModels.AccessRule
    })
    // const accessRights = new MemoryAccessRights()
    const attributeRetriever = async ({sourceIdentitySignature, identity, attrType, attrId}) => {
      const cookieJar = request.jar()
      const req = request.defaults({jar: cookieJar})

      await req({
        method: 'POST',
        uri: new URL(identity).origin + '/login',
        form: {identity: sourceIdentitySignature.data, signature: sourceIdentitySignature.signature}
      })

      const response = (await req({
        method: 'GET',
        uri: `${identity}/identity/${attrType}/${attrId}`,
        resolveWithFullResponse: true
      }))

      let attribute = response.body
      if (response.headers['content-type'].indexOf('application/json') === 0) {
        attribute = JSON.parse(response.body)
      }
      return attribute
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
    if (DEVELOPMENT_MODE || ethereumConfig.testSetup) {
      if (!ethereumConfig) {
        ethereumConfig = {}
      }
      if (!ethereumConfig.gethHost) {
        ethereumConfig.gethHost = 'http://localhost:8545'
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
    if ((DEVELOPMENT_MODE || ethereumConfig.testSetup) && !ethereumConfig.lookupContractAddress) {
      await walletManager.setupTestRPC({
        seedPhrase: 'mandate print cereal style toilet hole cave mom heavy fork network indoor'
      })
      console.log(
        'Deployed test contracts! LookupContract:',
        walletManager._config.lookupContractAddress
      )
    }

    const etherBalanceWatcher = new EtherBalanceWatcher({walletManager})
    const ethereumInteraction = new EthereumInteraction({
      walletManager,
      contractInfoRetriever: async ({contractOwnerIdentity, contractID}) => {
        const cookieJar = request.jar()
        const req = request.defaults({jar: cookieJar})
        const res = await req({
          method: 'GET',
          uri: `${contractOwnerIdentity}/ethereum/contracts/${contractID}`,
          json: true
        })
        return res
      }
    })
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

    let inviteStore = null
    if (config.firstInviteCode) {
      inviteStore = new SequelizeInviteStore({
        inviteModel: sequelizeModels.RegistrationInvite,
        codeGenerator: new RandomCodeGenerator({
          codeLength: 16,
          digitOnly: false
        })
      })

      if (await identityStore.isEmpty()) {
        await inviteStore.generate({code: config.firstInviteCode})
      }
    }

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
        getMainAddressBySeedPhrase: (seedPhrase) => walletManager.getMainAddressBySeedPhrase(seedPhrase),
        // privateKeyGenerator: new DummyGatewayPrivateKeyGenerator(),
        privateKeyGenerator: new GatewayPrivateKeyGenerator({privateKeySize}),
        inviteStore
      }),
      inviteStore,
      dataSigner: new DataSigner({identityStore}),
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
      etherBalanceWatcher
    })

    if (DEVELOPMENT_MODE) {
      await devPostInit({}, {
        lookupContractAddress: walletManager._config.lookupContractAddress
      })
    }

    return server
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
