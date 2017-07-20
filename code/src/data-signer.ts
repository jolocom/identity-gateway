import * as openpgp from 'openpgp'
import { GatewayIdentityStore } from './identity-store'

export class DataSigner {
  private _identityStore : GatewayIdentityStore

  constructor({identityStore} : {identityStore : GatewayIdentityStore}) {
    this._identityStore = identityStore
  }

  async signData({data, seedPhrase} : {data : string, seedPhrase : string}) : Promise<string> {
    const keyPair = await this._identityStore.getKeyPairBySeedPhrase(seedPhrase)
    const privKeyObj = openpgp.key.readArmored(keyPair.privateKey).keys[0];
    privKeyObj.decrypt(seedPhrase)
    
    const result = await openpgp.sign({
        data,
        privateKeys: privKeyObj,
        detached: true
    })

    return result.signature
  }
}