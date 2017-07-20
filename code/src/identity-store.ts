import { KeyPair } from './private-key-stores';

export interface GatewayIdentityStore {
  storeIdentity({userName, seedPhrase, keyPair})
  getUserNameBySeedPhrase({seedPhrase})
}

export class GatewayMemoryIdentityStore implements GatewayIdentityStore {
  private identities = {}

  async storeIdentity({userName, seedPhrase, keyPair}) {
    this.identities[seedPhrase] = {userName, keyPair}
  }
  
  async getUserNameBySeedPhrase({seedPhrase}) {
    return this.identities[seedPhrase].userName
  }

  async getKeyPairBySeedPhrase({seedPhrase}) {
    return this.identities[seedPhrase].keyPair
  }
}
