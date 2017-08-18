import { GatewayIdentityStore } from './identity-store';
import { GatewayPrivateKeyGenerator, SolidPrivateKeyGenerator } from './private-key-generators';

export class GatewayIdentityCreator {
  private _privateKeyGenerator : GatewayPrivateKeyGenerator
  private _identityStore : GatewayIdentityStore

  constructor({privateKeyGenerator, identityStore} :
              {privateKeyGenerator : GatewayPrivateKeyGenerator,
               identityStore : GatewayIdentityStore})
  {
    this._privateKeyGenerator = privateKeyGenerator
    this._identityStore = identityStore
  }

  async createIdentity({userName, seedPhrase} :
                       {userName : string, seedPhrase : string})
  {
    const keyPair = await this._privateKeyGenerator.generate({
      name: `https://identity.jolocom.com/${userName}`,
      email: `${userName}@identity.jolocom.com`,
      passphrase: seedPhrase
    })
    await this._identityStore.storeIdentity({
      userName, keyPair, seedPhrase
    })
  }
}

export class SolidIdentityCreator {
  constructor({solidServerUri, privateKeyGenerator} :
              {solidServerUri : string, privateKeyGenerator : SolidPrivateKeyGenerator})
  {

  }

  createIdentity({userName, seedPhrase}) {

  }
}

export class EthereumIdentityCreator {
  private _walletManager

  constructor({walletManager}) {
    this._walletManager = walletManager
  }

  async createIdentity({seedPhrase, publicKey, identityURL}) {
    let wallet = await this._walletManager.register({
      seedPhrase,
      identityURL,
      publicKey
    })
    return {
      mainAddress: wallet.mainAddress,
      identityAddress: wallet.identityAddress
    }
  }
}
