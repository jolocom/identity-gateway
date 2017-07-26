import * as _ from 'lodash'
import { KeyPair } from './key-pair'

export interface GatewayIdentityStore {
  storeIdentity({userName, seedPhrase, keyPair})
  getUserIdBySeedPhrase(seedPhrase) : Promise<string>
  getUserIdByUserName(userName) : Promise<string>
  getKeyPairBySeedPhrase(seedPhrase) : Promise<KeyPair>
  getPublicKeyByUserName(userName) : Promise<string>
}

export class GatewayMemoryIdentityStore implements GatewayIdentityStore {
  private identities = {}

  async storeIdentity({userName, seedPhrase, keyPair}) {
    this.identities[seedPhrase] = {userName, keyPair}
  }
  
  async getUserIdBySeedPhrase(seedPhrase) {
    return this.identities[seedPhrase].userName
  }
  
  async getUserIdByUserName(userName) {
    return (_.find(this.identities, {userName}) || {}).userName
  }

  async getKeyPairBySeedPhrase(seedPhrase) {
    return this.identities[seedPhrase].keyPair
  }

  async getPublicKeyByUserName(userName) : Promise<string> {
    return ((_.find(this.identities, {userName}) || {}).keyPair || {}).publicKey
  }
}
