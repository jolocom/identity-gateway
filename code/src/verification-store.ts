import * as events from 'events'
import * as openpgp from 'openpgp'
import { AttributeStore } from './attribute-store';

export type PublicKeyRetriever = (string) => Promise<string>
export interface PublicKeyRetrievers { [type : string] : (...args) => Promise<string> }

export abstract class VerificationStore {
  private _attributeStore : AttributeStore
  private _publicKeyRetrievers : PublicKeyRetrievers
  public events : events.EventEmitter

  constructor({attributeStore, publicKeyRetrievers} :
              {attributeStore : AttributeStore, publicKeyRetrievers : PublicKeyRetrievers})
  {
    this._attributeStore = attributeStore
    this._publicKeyRetrievers = publicKeyRetrievers
    this.events = new events.EventEmitter()
  }

  abstract storeVerification({
    userId, attrType, attrId, verifierIdentity, linkedIdentities, signature
  }) : Promise<string>
  abstract getVerifications({userId, attrType, attrId}) : Promise<any>

  async getVerification({userId, attrType, attrId, verificationId}) {
    return this.getVerifications({userId, attrType, attrId})[verificationId]
  }

  protected async checkVerification({
    userId, attrType, attrId,
    verifierIdentity, linkedIdentities, signature
  }) {
    let armoredPublicKey
    if (linkedIdentities && linkedIdentities.ethereum) {
      armoredPublicKey = linkedIdentities.ethereum.publicKey
    } else {
      armoredPublicKey = this._publicKeyRetrievers.url(verifierIdentity)
    }

    const attrValue = (await this._attributeStore.retrieveStringAttribute({
      userId, type: attrType, id: attrId
    })).value
    const result = await openpgp.verify({
      message: new openpgp.cleartext.CleartextMessage(attrValue),
      signature: openpgp.signature.readArmored(signature),
      publicKeys: openpgp.key.readArmored(armoredPublicKey).keys
    })
    return result.signatures[0].valid
  }
}

export class MemoryVerificationStore extends VerificationStore {
  private _verfications = {}

  async storeVerification({userId, attrType, attrId, verifierIdentity, linkedIdentities, signature}) {
    if (!this.checkVerification({userId, attrType, attrId, verifierIdentity, linkedIdentities, signature})) {
      return
    }

    if (!this._verfications[userId]) {
      this._verfications[userId] = {}
    }
    const userVerifications = this._verfications[userId]

    const verificationsKey = `${attrType}_${attrId}`
    if (!userVerifications[verificationsKey]) {
      userVerifications[verificationsKey] = {}
    }
    const attrVerifications = userVerifications[verificationsKey]

    const verificationId = Date.now().toString()
    attrVerifications[verificationId] = {verifierIdentity, signature}

    this.events.emit('verification.stored', {
      userId, attrType, attrId, verificationId
    })

    return verificationId
  }

  async getVerifications({userId, attrType, attrId}) {
    const userVerifications = this._verfications[userId]
    const verificationsKey = `${attrType}_${attrId}`
    const attrVerifications = userVerifications[verificationsKey]
    return attrVerifications
  }
}

export class SequelizeVerificationStore extends VerificationStore {
  private _attributeModel
  private _verificationModel
  protected _getEthereumAccountByUri : (uri : string) => Promise<{identityAddress, publicKey}>

  constructor({attributeModel, verificationModel, attributeStore,
               publicKeyRetrievers, getEthereumAccountByUri} :
              {attributeModel, verificationModel, attributeStore : AttributeStore,
               publicKeyRetrievers : PublicKeyRetrievers,
               getEthereumAccountByUri : (uri : string) => Promise<{identityAddress, publicKey}>})
  {
    super({attributeStore, publicKeyRetrievers})
    this._attributeModel = attributeModel
    this._verificationModel = verificationModel
    this._getEthereumAccountByUri = getEthereumAccountByUri
  }

  async storeVerification({userId, attrType, attrId, verifierIdentity, linkedIdentities, signature}) {
    linkedIdentities = linkedIdentities || {}
    linkedIdentities.ethereum = linkedIdentities.ethereum &&
      await this._getEthereumAccountByUri(verifierIdentity)

    if (!this.checkVerification({userId, attrType, attrId, verifierIdentity, linkedIdentities, signature})) {
      return
    }
    
    const attribute = await this._attributeModel.findOne({where: {
      identityId: userId, type: attrType, key: attrId,
    }})
    const verification = await this._verificationModel.create({
      attributeId: attribute.id,
      identity: verifierIdentity,
      linkedIdentities: JSON.stringify({
        ethereum: linkedIdentities.ethereum ? linkedIdentities.ethereum.identityAddress : null
      }),
      signature
    })
    this.events.emit('verification.stored', {
      userId, attrType, attrId, verificationId: verification.id
    })
    return verification.id
  }

  async getVerifications({userId, attrType, attrId}) {
    const attribute = await this._attributeModel.findOne({where: {
      identityId: userId, type: attrType, key: attrId,
    }})
    const verificationRecords = await this._verificationModel.findAll({where: {
      attributeId: attribute.id
    }})

    const verifications = {}
    verificationRecords.forEach(verification => {
      verifications[verification.id] = {
        verifierIdentity: verification.identity,
        signature: verification.signature,
        linkedIdentities: JSON.parse(verification.linkedIdentities)
      }
    })

    return verifications
  }
}
