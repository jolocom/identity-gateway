import * as openpgp from 'openpgp'
import { GatewayIdentityStore } from './identity-store'

export class DataSigner {
  private _identityStore : GatewayIdentityStore

  constructor({identityStore} : {identityStore : GatewayIdentityStore}) {
    this._identityStore = identityStore
  }

  async signData({
    data,
    seedPhrase,
    combine
  } : {
    data : string,
    seedPhrase : string,
    combine? : boolean
  }) : Promise<{data, signature}> 
  {
    const keyPair = await this._identityStore.getKeyPairBySeedPhrase(seedPhrase)
    const privKeyObj = openpgp.key.readArmored(keyPair.privateKey).keys[0]
    if(!privKeyObj.decrypt(seedPhrase)) {
      console.log('Failed to decrypt private key', seedPhrase, keyPair.privateKey)
      return null
    }
    
    const result = await openpgp.sign({
        data,
        privateKeys: privKeyObj,
        detached: !combine
    })

    return result
  }
}
