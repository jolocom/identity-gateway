import * as openpgp from 'openpgp'
import { KeyPair } from './key-pair'
openpgp.initWorker({ path: '../node_modules/openpgp/dist/openpgp.worker.js' })

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

export class DummyGatewayPrivateKeyGenerator {
  async generate({name, email, passphrase} :
           {name : string, email : string, passphrase : string}) :
           Promise<KeyPair>
  {
    return {
      publicKey: `PUBLIC KEY: ${name} (${email})`,
      privateKey: `PRIVATE KEY: ${name} (${email})`
    }
  }
}

export class SolidPrivateKeyGenerator {
  
}
