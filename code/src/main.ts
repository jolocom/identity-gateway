import { MemorySessionStore } from './session-store';
require('source-map-support').install()
require('regenerator-runtime/runtime')
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
import { OAuthModel, MemoryTokenStore } from './oauth';
import { defineSequelizeModels } from './sequelize/models';
import { createApp } from './app'
import * as openpgp from 'openpgp'
openpgp.initWorker({ path: '../node_modules/openpgp/dist/openpgp.worker.js' })


const DEVELOPMENT_MODE = process.env.NODE_ENV === 'dev';


export async function main() : Promise<any> {
  try {
    const sequelize = new Sequelize('sqlite://')
    await sequelize.authenticate()
    
    const sequelizeModels = defineSequelizeModels(sequelize)
    await sequelize.sync()

    const identityStore = new SequelizeGatewayIdentityStore({
      identityModel: sequelizeModels.Identity
    })
    const attributeStore = new SequelizeAttributeStore({
      attributeModel: sequelizeModels.Attribute
    })
    const publicKeyRetriever = async (identity) => {
      return (await request(identity)).publicKey
    }
    const attributeRetriever = async ({identity, attrType, attrId}) => {
      return (await request(`${identity}/identity/${attrType}/${attrId}`))
    }
    const verificationSender = async ({identity, attrType, attrId, signature}) => {
      await request({
        method: 'PUT',
        uri: `${identity}/identity/${attrType}/${attrId}`,
        body: signature
      })
    }
    const app = createApp({
      sessionStore: new MemorySessionStore(),
      accessRights: new MemoryAccessRights(),
      identityStore: identityStore,
      attributeStore,
      verificationStore: new SequelizeVerificationStore({
        attributeModel: sequelizeModels.Attribute,
        verificationModel: sequelizeModels.Verification,
        attributeStore, publicKeyRetriever
      }),
      identityCreator: new GatewayIdentityCreator({
        identityStore,
        privateKeyGenerator: new DummyGatewayPrivateKeyGenerator(),
        // privateKeyGenerator: new GatewayPrivateKeyGenerator(),
      }),
      attributeVerifier: new AttributeVerifier({
        dataSigner: new DataSigner({identityStore}),
        attributeRetriever,
        verificationSender
      })
    })

    const server = http.createServer(app)
    return await new Promise((resolve, reject) => {
      server.listen(process.env.IDENTITY_PORT || 4567, (err) => {
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
