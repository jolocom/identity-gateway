import { KeyPair } from './key-pair'
import * as gpg from 'gpg'
import * as openpgp from 'openpgp'
import * as tmp from 'tmp-promise'
import * as bluebird from 'bluebird'
import fs = require('mz/fs')

export class GatewayPrivateKeyGenerator {
  private _privateKeySize : number

  constructor ({privateKeySize} : {privateKeySize : number}) {
    this._privateKeySize = privateKeySize
  }

  async generate({name, email, passphrase} :
           {name : string, email : string, passphrase : string}) :
           Promise<KeyPair>
  {
    // const gpgCall = bluebird.promisify(gpg.call)
    // let publicKeyArmored, privateKeyArmored

    // await tmp.withDir(async tmpDir => {
    //   const scriptContent = generateGPGScript({name, email, passphrase, tmpDirPath: tmpDir.path})
    //   await fs.writeFile('/tmp/gpg_script', scriptContent)
    //   await fs.writeFile(`${tmpDir.path}/script`, scriptContent)
    //   await gpgCall(null, ['--batch', '--gen-key', '-a', `${tmpDir.path}/script`])
    //   await require('fs-extra').copy(`${tmpDir.path}/sec.key`, '/tmp/bla.key')
    //   if (1) return
      
    //   publicKeyArmored = (await fs.readFile(`${tmpDir.path}/pub.key`)).toString()
    //   privateKeyArmored = (await fs.readFile(`${tmpDir.path}/sec.key`)).toString()
    // }, {unsafeCleanup: true})

    // console.log('generated private key', name, passphrase, privateKeyArmored)
    // await fs.writeFile('/tmp/priv.key', privateKeyArmored)

    var options = {
        userIds: [{ name, email }],
        numBits: this._privateKeySize,
        passphrase: passphrase
    };

    const {publicKeyArmored, privateKeyArmored} = await openpgp.generateKey(options)

    return {
      publicKey: publicKeyArmored,
      privateKey: privateKeyArmored
    }
  }
}

export function generateGPGScript({name, email, passphrase, tmpDirPath}) {
  return `
Key-Type: 1
Key-Length: 2048
Subkey-Type: 1
Subkey-Length: 2048
Name-Real: ${name}
Name-Email: ${email}
Expire-Date: 0
Passphrase: ${passphrase}
%pubring ${tmpDirPath}/pub.key
%secring ${tmpDirPath}/sec.key
%commit
`.trim()
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
