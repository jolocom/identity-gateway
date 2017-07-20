export interface GatewayIdentityStore {
  storeIdentity({userName, seedPhrase, keyPair})
  getUserIdBySeedPhrase({seedPhrase})
}

export class GatewayMemoryIdentityStore implements GatewayIdentityStore {
  private identities = {}

  async storeIdentity({userName, seedPhrase, keyPair}) {
    this.identities[seedPhrase] = {userName, keyPair}
  }
  
  async getUserIdBySeedPhrase({seedPhrase}) {
    return this.identities[seedPhrase].userName
  }

  async getKeyPairBySeedPhrase({seedPhrase}) {
    return this.identities[seedPhrase].keyPair
  }
}
