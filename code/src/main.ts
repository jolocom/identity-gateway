import { AttributeChecker } from './attribute-checker';
import { MemorySessionStore } from './session-store';
require('source-map-support').install()
require('regenerator-runtime/runtime')
import * as _ from 'lodash'
import * as URL from 'url-parse'
import * as http from 'http'
import { spawnSync } from 'child_process'
import * as bluebird from 'bluebird'
import * as request from 'request-promise-native'
import * as Sequelize from 'sequelize'
import { DataSigner } from './data-signer'
import { GatewayPrivateKeyGenerator, DummyGatewayPrivateKeyGenerator } from './private-key-generators'
import { GatewayIdentityCreator, EthereumIdentityCreator } from './identity-creators'
import { AttributeVerifier } from './attribute-verifier'
import { MemoryVerificationStore, SequelizeVerificationStore } from './verification-store'
import { MemoryAttributeStore, SequelizeAttributeStore } from './attribute-store'
import { MemoryAccessRights, SequelizeAccessRights } from './access-rights'
import { MemoryGatewayIdentityStore, SequelizeGatewayIdentityStore } from './identity-store'
import { WalletManager, Wallet } from 'smartwallet-contracts'
import { defineSequelizeModels } from './sequelize/models'
import { createApp } from './app'
import * as openpgp from 'openpgp'
openpgp.initWorker({ path: '../node_modules/openpgp/dist/openpgp.worker.js' })


const DEVELOPMENT_MODE = process.env.NODE_ENV === 'dev';


export async function main() : Promise<any> {
  const config = require('../config.json')

  try {
    const sequelize = new Sequelize(process.env.DATABASE || 'sqlite://')
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
    const accessRights = new SequelizeAccessRights({
      ruleModel: sequelizeModels.Rule
    })
    const publicKeyRetriever = async (identity) => {
      return JSON.parse((await request(identity))).publicKey
    }
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
          'Content-Type': 'text/json'
        },
        body: JSON.stringify({
          linkedIdenities: sourceLinkedIdentities,
          signature: signature.signature
        })
      })
    }

    // const walletManager = new WalletManager(config.ethereum)
    const walletManager = null
    const ethereumIdentityCreator = new EthereumIdentityCreator({walletManager, identityStore})
    const getEthereumAccountBySeedPhrase = async (seedPhrase : string) => {
      const wallet = new Wallet(config)
      await wallet.init(seedPhrase)
      return {
        walletAddress: wallet.mainAddress,
        identityAddress: wallet.identityAddress,
      }
    }
    const getEthereumAccountByUri = async (uri : string) : Promise<{identityAddress, publicKey}> => {
      return {
        identityAddress: '0x0', publicKey: 'pkey'
      }
    }

    const app = createApp({
      sessionStore: new MemorySessionStore(),
      accessRights,
      identityUrlBuilder,
      identityStore: identityStore,
      attributeStore,
      publicKeyRetriever,
      verificationStore: new SequelizeVerificationStore({
        attributeModel: sequelizeModels.Attribute,
        verificationModel: sequelizeModels.Verification,
        attributeStore, publicKeyRetriever,
        getEthereumAccountByUri
      }),
      identityCreator: new GatewayIdentityCreator({
        identityStore,
        // privateKeyGenerator: new DummyGatewayPrivateKeyGenerator(),
        privateKeyGenerator: new GatewayPrivateKeyGenerator({privateKeySize}),
      }),
      ethereumIdentityCreator,
      attributeVerifier: new AttributeVerifier({
        dataSigner: new DataSigner({identityStore}),
        attributeRetriever,
        verificationSender,
        identityStore
      }),
      attributeChecker: new AttributeChecker({
        dataSigner: new DataSigner({identityStore}),
        publicKeyRetriever,
        attributeRetriever,
        verificationsRetriever
      }),
      getEthereumAccountBySeedPhrase
    })

    const server = http.createServer(app)
    await new Promise((resolve, reject) => {
      server.listen(parseInt(process.env.IDENTITY_PORT) || 5678, (err) => {
        if (err) { return reject(err) }
        resolve(server)
      })
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
  const gatewayURL = 'http://localhost:' + (process.env.IDENTITY_PORT || '5678')
  const firstUser = {
    userName: process.env.FIRST_USER_NAME || 'joe',
    seedPhrase: process.env.FIRST_USER_SEED_PHRASE || 'user1 seed phrase'
  }
  const secondUser = {
    create: process.env.SECOND_USER_SEED_PHRASE || process.env.CREATE_SECOND_USER === 'true',
    userName: process.env.SECOND_USER_NAME || 'jane',
    seedPhrase: process.env.SECOND_USER_SEED_PHRASE || 'user2 seed phrase'
  }

  const cookieJar_1 = request.jar()
  const session_1 = request.defaults({jar: cookieJar_1})
  const cookieJar_2 = request.jar()
  const session_2 = request.defaults({jar: cookieJar_2})

  await session_1({
    method: 'PUT',
    uri: `${gatewayURL}/${firstUser.userName}`,
    form: {seedPhrase: firstUser.seedPhrase}
  })
  await session_1({
    method: 'POST',
    uri: gatewayURL + '/login',
    form: {seedPhrase: firstUser.seedPhrase}
  })

  if (secondUser.create) {
    await session_2({
      method: 'PUT',
      uri: `${gatewayURL}/${secondUser.userName}`,
      form: {seedPhrase: secondUser.seedPhrase}
    })
    await session_2({
      method: 'POST',
      uri: gatewayURL + '/login',
      form: {seedPhrase: secondUser.seedPhrase}
    })
  }
}

if(require.main === module){
  main()
}
