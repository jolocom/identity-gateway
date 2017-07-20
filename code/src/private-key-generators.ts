import * as openpgp from 'openpgp'
import { KeyPair } from './private-key-stores'

export class GatewayPrivateKeyGenerator {
  async generate({name, email, passphrase} :
           {name : string, email : string, passphrase : string}) :
           Promise<KeyPair>
  {
    var options = {
        userIds: [{ name, email }],
        numBits: 4096,
        passphrase
    };
    
    const key = await openpgp.generateKey(options)
    return {
      publicKey: key.publicKeyArmored,
      privateKey: key.publicKeyArmored
    }
  }
}

export class SolidPrivateKeyGenerator {
  
}
