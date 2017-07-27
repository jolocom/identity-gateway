import { KeyPair } from './key-pair'
import { gpg } from 'gpg'
import fs = require('fs')

export class GatewayPrivateKeyGenerator {
  async generate({name, email, passphrase} :
           {name : string, email : string, passphrase : string}) :
           Promise<KeyPair>
  {

    await new Promise(function(resolve, reject) {
      gpg.call(null, ['--batch', '--gen-key', 'script_file'], () => {
        gpg.call(null, ['--enarmor', '/tmp/pub.key'], () => {
          gpg.call(null, ['--enarmor', '/tmp/sec.key'], () => {
            resolve()
          })
        })
      })
    })

    let publicKeyArmored
    await new Promise(function(resolve, reject) {
      fs.readFile('/tmp.pub.key.asc', null , (err, data) => {
        if (err) {
          reject()
        }
        publicKeyArmored = data
        resolve()
      })
    })

    let privateKeyArmored
    await new Promise(function(resolve, reject) {
      fs.readFile('/tmp.sec.key.asc', null , (err, data) => {
        if (err) {
          reject()
        }
        privateKeyArmored = data
        resolve()
      })
    })

    return {
      publicKey: publicKeyArmored,
      privateKey: publicKeyArmored
    }

  }
}

export class SolidPrivateKeyGenerator {

}
