import { KeyPair } from './key-pair'
import * as gpg from 'gpg'
import * as tmp from 'tmp-promise'
import * as bluebird from 'bluebird'
import fs = require('mz/fs')

export class GatewayPrivateKeyGenerator {
  async generate({name, email, passphrase} :
           {name : string, email : string, passphrase : string}) :
           Promise<KeyPair>
  {
    const gpgCall = bluebird.promisify(gpg.call)
    let publicKeyArmored, privateKeyArmored

    await tmp.withDir(async tmpDir => {
      const scriptContent = generateGPGScript({name, email, passphrase, tmpDirPath: tmpDir.path})
      await fs.writeFile(`${tmpDir.path}/script`, scriptContent)
      await gpgCall(null, ['--batch', '--gen-key', `${tmpDir.path}/script`])
      await gpgCall(null, ['--enarmor', `${tmpDir.path}/pub.key`])
      await gpgCall(null, ['--enarmor', `${tmpDir.path}/sec.key`])

      publicKeyArmored = (await fs.readFile(`${tmpDir.path}/pub.key.asc`)).toString()
      privateKeyArmored = (await fs.readFile(`${tmpDir.path}/sec.key.asc`)).toString()
    }, {unsafeCleanup: true})

    return {
      publicKey: publicKeyArmored,
      privateKey: publicKeyArmored
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
