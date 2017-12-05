import * as openpgp from 'openpgp'
import { GatewayIdentityStore } from './identity-store'

export class DataSigner {
  private _identityStore : GatewayIdentityStore

  constructor({identityStore} : {identityStore : GatewayIdentityStore}) {
    this._identityStore = identityStore
  }
  
  async signData({data, seedPhrase} : {data : any, seedPhrase : string}) : Promise<{data, signature}> {
    const keyPair = await this._identityStore.getKeyPairBySeedPhrase(seedPhrase)
    const privKeyObj = openpgp.key.readArmored(keyPair.privateKey).keys[0]
    if(!privKeyObj.decrypt(seedPhrase)) {
      console.log('Failed to decrypt private key', seedPhrase, keyPair.privateKey)
      return null
    }
    const result = await openpgp.sign({
        data,
        privateKeys: privKeyObj,
        detached: true
    })

    // console.log(' | ', result.data, ' | ', result.signature, ' | ', keyPair.publicKey)

    // const verify = await openpgp.verify({
    //   message: openpgp.cleartext.readArmored(result.data),
    //   signature: openpgp.signature.readArmored(result.signature),
    //   publicKeys: openpgp.key.readArmored(keyPair.publicKey).keys
    // })

    // console.log(verify.signatures[0])

    return result
  }
}
