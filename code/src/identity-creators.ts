import { GatewayIdentityStore } from './identity-store';
import { GatewayPrivateKeyGenerator, SolidPrivateKeyGenerator } from './private-key-generators';

export class GatewayIdentityCreator {
  private _privateKeyGenerator : GatewayPrivateKeyGenerator
  private _identityStore : GatewayIdentityStore
  private _getMainAddressBySeedPhrase


  constructor({privateKeyGenerator, identityStore, getMainAddressBySeedPhrase} :
              {privateKeyGenerator : GatewayPrivateKeyGenerator,
              identityStore : GatewayIdentityStore,
              getMainAddressBySeedPhrase : (string) => Promise<string>})
  {
    this._privateKeyGenerator = privateKeyGenerator
    this._identityStore = identityStore
    this._getMainAddressBySeedPhrase = getMainAddressBySeedPhrase
  }

  async createIdentity({userName, seedPhrase} :
                       {userName : string, seedPhrase : string})
  {
    const keyPair = await this._privateKeyGenerator.generate({
      name: `https://identity.jolocom.com/${userName}`,
      email: `${userName}@identity.jolocom.com`,
      passphrase: seedPhrase
    })

    const {userId} = await this._identityStore.storeIdentity({
      userName, keyPair, seedPhrase
    })

    await this._identityStore.linkIdentity({userId, identities: {
        type: 'ethereum:wallet',
        identifier: await this._getMainAddressBySeedPhrase(seedPhrase)
      }
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
  private _identityStore : GatewayIdentityStore

  constructor({identityStore, walletManager} :
              {identityStore : GatewayIdentityStore, walletManager})
  {
    this._identityStore = identityStore
    this._walletManager = walletManager
  }

  async createIdentity({seedPhrase, userId, publicKey, identityURL}) :
    Promise<{walletAddress, identityAddress}>
  {
    let wallet = await this._walletManager.register({
      seedPhrase,
      uri: identityURL,
      publicKey,
      pin: this._walletManager._config.pin
    })

    let walletAddress = wallet.mainAddress
    if (walletAddress.indexOf('0x') !== 0) {
      walletAddress = '0x' + walletAddress
    }

    await this._identityStore.linkIdentity({userId, identities: [
      {type: 'ethereum:wallet', identifier: walletAddress},
      {type: 'ethereum:identity', identifier: wallet.identityAddress},
    ]})
    return {
      walletAddress: wallet.mainAddress,
      identityAddress: wallet.identityAddress
    }
  }
}
