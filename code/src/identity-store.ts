import * as _ from 'lodash'
import * as crypto from 'crypto'
import { KeyPair } from './key-pair'
import { createOrUpdate } from './sequelize/utils'

export interface LinkedIdentitiesMap {
  [type : string] : string
}

export interface GatewayIdentityStore {
  storeIdentity({userName, seedPhrase, keyPair}) : Promise<{userId}>
  getUserBySeedPhrase(seedPhrase) : Promise<{id, userName}>
  getUserIdByUserName(userName) : Promise<string>
  getKeyPairBySeedPhrase(seedPhrase) : Promise<KeyPair>
  getPublicKeyByUserName(userName) : Promise<string>

  linkIdentity({userId, identities} :
               {userId : string,
                identities : Array<{type, identifier}> | {type, identifier}}) : Promise<any>
  getLinkedIdentity({userId, type} : {userId : string, type : string}) : Promise<string>
  getLinkedIdentities({userId} : {userId : string}) : Promise<LinkedIdentitiesMap>
  isEmpty() : Promise<boolean>
}

export class MemoryGatewayIdentityStore implements GatewayIdentityStore {
  private identities = {}

  async storeIdentity({userName, seedPhrase, keyPair}) {
    this.identities[seedPhrase] = {userName, keyPair}
    return {userId: userName}
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

  async linkIdentity({userId, identities} :
                       {userId : string,
                        identities : Array<{type, identifier}> | {type, identifier}})
  {
    throw new Error("Not implemented yet")
  }

  async getLinkedIdentity({userId, type} : {userId : string, type : string}) {
    if (1)
      throw new Error("Not implemented yet")
    return 'shut up, type checking'
  }

  async getLinkedIdentities({userId} : {userId : string}) {
    if (1)
      throw new Error("Not implemented yet")
    return {}
  }

  async isEmpty() {
    return Object.keys(this.identities).length === 0
  }
}

export class SequelizeGatewayIdentityStore implements GatewayIdentityStore {
  private _identityModel
  private _linkedIdentityModel

  constructor({identityModel, linkedIdentityModel}) {
    this._identityModel = identityModel
    this._linkedIdentityModel = linkedIdentityModel
  }

  async storeIdentity({userName, seedPhrase, keyPair}) {
    const seedPhraseHashObject = crypto.createHash('sha512')
    seedPhraseHashObject.update(seedPhrase)
    const seedPhraseHash = seedPhraseHashObject.digest('hex')

    const record = await this._identityModel.create({
      userName,
      seedPhraseHash: seedPhraseHash,
      dataBackend: 'mysql',
      verificationBackend: 'mysql+pgp',
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
    })
    return {userId: record.id}
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
    const identity = await this._identityModel.findOne({where: {userName}})
    return identity && identity.publicKey
  }

  async linkIdentity({userId, identities} :
                       {userId : string,
                        identities : Array<{type, identifier}> | {type, identifier}})
  {
    if (!(identities instanceof Array)) {
      identities = [identities]
    }

    for(let identity of identities) {
      await createOrUpdate(this._linkedIdentityModel,
        {identityId: userId, type: identity.type},
        {identifier: identity.identifier}
      )
    }

    // await Promise.all(identities.map(identity => {
    //   return createOrUpdate(this._linkedIdentityModel,
    //     {identityId: userId, type: identity.type},
    //     {identifier: identity.identifier}
    //   )
    // }))
  }

  async getLinkedIdentity({userId, type} : {userId : string, type : string}) {
    return await this._linkedIdentityModel.findOne({where: {identityId: userId, type}})
  }

  async getLinkedIdentities({userId} : {userId : string}) {
    return await _.fromPairs(
      (await this._linkedIdentityModel
        .findAll({where: {identityId: userId}})
      ).map(identity => [identity.type, identity.identifier])
      )
  }

  async isEmpty() {
    return (await this._identityModel.findOne({where: {}})) === null
  }
}
