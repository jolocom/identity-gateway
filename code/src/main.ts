import { AttributeChecker } from './attribute-checker';
import { MemorySessionStore } from './session-store';
require('source-map-support').install()
require('regenerator-runtime/runtime')
import * as _ from 'lodash'
import * as URL from 'url-parse'
import * as http from 'http'
import * as bluebird from 'bluebird'
import * as request from 'request-promise-native'
import * as Sequelize from 'sequelize'
import { DataSigner } from './data-signer';
import { GatewayPrivateKeyGenerator, DummyGatewayPrivateKeyGenerator } from './private-key-generators';
import { GatewayIdentityCreator } from './identity-creators';
import { AttributeVerifier } from './attribute-verifier';
import { MemoryVerificationStore, SequelizeVerificationStore } from './verification-store';
import { MemoryAttributeStore, SequelizeAttributeStore } from './attribute-store';
import { MemoryAccessRights } from './access-rights';
import { MemoryGatewayIdentityStore, SequelizeGatewayIdentityStore } from './identity-store';
import { defineSequelizeModels } from './sequelize/models';
import { createApp } from './app'
import * as openpgp from 'openpgp'
openpgp.initWorker({ path: '../node_modules/openpgp/dist/openpgp.worker.js' })


const DEVELOPMENT_MODE = process.env.NODE_ENV === 'dev';


export async function main() : Promise<any> {
  try {
    const sequelize = new Sequelize(process.env.DATABASE || 'sqlite://')
    await sequelize.authenticate()
    
    const sequelizeModels = defineSequelizeModels(sequelize)
    if (DEVELOPMENT_MODE || process.env.SYNC === 'true') {
      await sequelize.sync()
    }

    const identityUrlBuilder = ({userName, req}) => {
      if (DEVELOPMENT_MODE) {
        return `http://localhost:4567/${userName}`
      } else {
        return `https://identity.jolocom.com/${userName}`
      }
    }
    const identityStore = new SequelizeGatewayIdentityStore({
      identityModel: sequelizeModels.Identity
    })
    const attributeStore = new SequelizeAttributeStore({
      attributeModel: sequelizeModels.Attribute
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
    const verificationSender = async ({sourceIdentitySignature, identity, attrType, attrId, signature}) => {
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
          'Content-Type': 'text/plain'
        },
        body: signature.signature
      })
    }
    const app = createApp({
      sessionStore: new MemorySessionStore(),
      accessRights: new MemoryAccessRights(),
      identityUrlBuilder,
      identityStore: identityStore,
      attributeStore,
      publicKeyRetriever,
      verificationStore: new SequelizeVerificationStore({
        attributeModel: sequelizeModels.Attribute,
        verificationModel: sequelizeModels.Verification,
        attributeStore, publicKeyRetriever
      }),
      identityCreator: new GatewayIdentityCreator({
        identityStore,
        // privateKeyGenerator: new DummyGatewayPrivateKeyGenerator(),
        privateKeyGenerator: new GatewayPrivateKeyGenerator(),
      }),
      attributeVerifier: new AttributeVerifier({
        dataSigner: new DataSigner({identityStore}),
        attributeRetriever,
        verificationSender
      }),
      attributeChecker: new AttributeChecker({
        dataSigner: new DataSigner({identityStore}),
        publicKeyRetriever,
        attributeRetriever,
        verificationsRetriever
      })
    })

    const server = http.createServer(app)
    return await new Promise((resolve, reject) => {
      server.listen(parseInt(process.env.IDENTITY_PORT) || 5678, (err) => {
        if (err) { return reject(err) }
        resolve(server)
      })
    })

  } catch (e) {
    console.error(e)
    console.trace()
  }
}


if(require.main === module){
  main()
}
