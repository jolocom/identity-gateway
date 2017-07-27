import { DataSigner } from './data-signer';
import { GatewayPrivateKeyGenerator } from './private-key-generators';
import { GatewayIdentityCreator } from './identity-creators';
import { AttributeVerifier } from './attribute-verifier';
import { MemoryVerificationStore } from './verification-store';
import { MemoryAttributeStore } from './attribute-store';
import { MemoryAccessRights } from './access-rights';
import { GatewayMemoryIdentityStore } from './identity-store';
import { OAuthModel, MemoryTokenStore } from './oauth';
require('source-map-support').install()
require('regenerator-runtime/runtime')
import * as http from 'http'
import * as bluebird from 'bluebird'
import * as request from 'request-promise-native'
import { createApp } from './app'

const DEVELOPMENT_MODE = process.env.NODE_ENV === 'dev';


export async function main() : Promise<any> {   
  try {
    const identityStore = new GatewayMemoryIdentityStore
    const attributeStore = new MemoryAttributeStore()
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
      oAuthModel: new OAuthModel({
        gatewayIdentityStore: identityStore,
        publicKeyRetriever,
        tokenStore: new MemoryTokenStore()
      }),
      accessRights: new MemoryAccessRights(),
      identityStore: new GatewayMemoryIdentityStore(),
      attributeStore,
      verificationStore: new MemoryVerificationStore({
        attributeStore, publicKeyRetriever
      }),
      identityCreator: new GatewayIdentityCreator({
        identityStore, privateKeyGenerator: new GatewayPrivateKeyGenerator()
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
  main();
}
