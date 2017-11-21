import { InviteStore } from './invite-store';
import { GatewayIdentityStore } from './identity-store';
import { GatewayPrivateKeyGenerator, SolidPrivateKeyGenerator } from './private-key-generators';
import { SequelizeAttributeStore } from './attribute-store'
const uuid = require('uuid/v1')

export class GatewayIdentityCreator {
  private _privateKeyGenerator : GatewayPrivateKeyGenerator
  private _identityStore : GatewayIdentityStore
  private _attributeStore : SequelizeAttributeStore
  private _getMainAddressBySeedPhrase
  private _inviteStore : InviteStore

  constructor({privateKeyGenerator, identityStore, getMainAddressBySeedPhrase,
               inviteStore, attributeStore} :
              {privateKeyGenerator : GatewayPrivateKeyGenerator,
               identityStore : GatewayIdentityStore,
               attributeStore : SequelizeAttributeStore,
               getMainAddressBySeedPhrase : (string) => Promise<string>,
               inviteStore? : InviteStore})
  {
    this._privateKeyGenerator = privateKeyGenerator
    this._identityStore = identityStore
    this._getMainAddressBySeedPhrase = getMainAddressBySeedPhrase
    this._inviteStore = inviteStore
    this._attributeStore = attributeStore
  }

  async createIdentity({userName, seedPhrase, overrideWalletAddress, inviteCode} :
                       {userName : string, seedPhrase : string,
                        overrideWalletAddress? : string,
                        inviteCode? : string})
  {
    if (this._inviteStore) {
      if (!(inviteCode && await this._inviteStore.check({code: inviteCode}))) {
        return false
      }
    }

    const keyPair = await this._privateKeyGenerator.generate({
      name: `https://identity.jolocom.com/${userName}`,
      email: `${userName}@identity.jolocom.com`,
      passphrase: seedPhrase
    })

    const {userId} = await this._identityStore.storeIdentity({
      userName, keyPair, seedPhrase
    })

    const address = !overrideWalletAddress
      ? await this._getMainAddressBySeedPhrase(seedPhrase)
      : overrideWalletAddress

    await this._identityStore.linkIdentity({userId, identities: {
        type: 'ethereum:wallet',
        identifier: !overrideWalletAddress
          ? await this._getMainAddressBySeedPhrase(seedPhrase)
          : overrideWalletAddress
      }
    })

    if (!overrideWalletAddress) {
      await this._attributeStore.storeStringAttribute({
        userId,
        type: 'ethereumWalletAddress',
        id: uuid(),
        value: await this._getMainAddressBySeedPhrase(seedPhrase)
      })
    }

    return true
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
