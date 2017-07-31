import * as _ from 'lodash'
import * as crypto from 'crypto'
import { KeyPair } from './key-pair'

export interface GatewayIdentityStore {
  storeIdentity({userName, seedPhrase, keyPair})
  getUserBySeedPhrase(seedPhrase) : Promise<{id, userName}>
  getUserIdByUserName(userName) : Promise<string>
  getKeyPairBySeedPhrase(seedPhrase) : Promise<KeyPair>
  getPublicKeyByUserName(userName) : Promise<string>
}

export class MemoryGatewayIdentityStore implements GatewayIdentityStore {
  private identities = {}

  async storeIdentity({userName, seedPhrase, keyPair}) {
    this.identities[seedPhrase] = {userName, keyPair}
  }
  
  async getUserBySeedPhrase(seedPhrase) {
    return {
      id: this.identities[seedPhrase].userName,
      userName: this.identities[seedPhrase].userName,
    }
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

export class SequelizeGatewayIdentityStore implements GatewayIdentityStore {
  private _identityModel

  constructor({identityModel}) {
    this._identityModel = identityModel
  }

  async storeIdentity({userName, seedPhrase, keyPair}) {
    const seedPhraseHashObject = crypto.createHash('sha512')
    seedPhraseHashObject.update(seedPhrase)
    const seedPhraseHash = seedPhraseHashObject.digest('hex')

    await this._identityModel.create({
      userName,
      seedPhraseHash: seedPhraseHash,
      dataBackend: 'mysql',
      verificationBackend: 'mysql+pgp',
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
    })
  }
  
  async getUserBySeedPhrase(seedPhrase) {
    const seedPhraseHashObject = crypto.createHash('sha512')
    seedPhraseHashObject.update(seedPhrase)
    const seedPhraseHash = seedPhraseHashObject.digest('hex')
    const identity = await this._identityModel.findOne({where: {seedPhraseHash}})
    return identity && {
      id: identity.id,
      userName: identity.userName
    }
  }
  
  async getUserIdByUserName(userName) {
    const identity = await this._identityModel.findOne({where: {userName}})
    return identity && identity.id
  }

  async getKeyPairBySeedPhrase(seedPhrase) {
    const seedPhraseHashObject = crypto.createHash('sha512')
    seedPhraseHashObject.update(seedPhrase)
    const seedPhraseHash = seedPhraseHashObject.digest('hex')
    const identity = await this._identityModel.findOne({where: {seedPhraseHash}})

    if (!identity) {
      return null
    }

    return {
      privateKey: identity.privateKey,
      publicKey: identity.publicKey,
    }
  }

  async getPublicKeyByUserName(userName) : Promise<string> {
    const identity = await this._identityModel.findOne({userName})
    return identity && identity.publicKey
  }
}
