import * as events from 'events'
import * as openpgp from 'openpgp'
import { AttributeStore } from './attribute-store';

export type PublicKeyRetriever = (string) => Promise<string>

export abstract class VerificationStore {
  private _attributeStore : AttributeStore
  private _publicKeyRetriever : PublicKeyRetriever
  public events : events.EventEmitter

  constructor({attributeStore, publicKeyRetriever} :
              {attributeStore : AttributeStore, publicKeyRetriever : PublicKeyRetriever})
  {
    this._attributeStore = attributeStore
    this._publicKeyRetriever = publicKeyRetriever
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
    if (linkedIdentities && linkedIdentities.ethereum) {
      
    }

    const attrValue = await this._attributeStore.retrieveStringAttribute({userId, type: attrType, id: attrId})
    const armoredPublicKey = this._publicKeyRetriever(verifierIdentity)
    const result = await openpgp.verify({
      message: openpgp.cleartext.readArmored(attrValue),
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
               publicKeyRetriever, getEthereumAccountByUri} :
              {attributeModel, verificationModel, attributeStore : AttributeStore,
               publicKeyRetriever : PublicKeyRetriever,
               getEthereumAccountByUri : (uri : string) => Promise<{identityAddress, publicKey}>})
  {
    super({attributeStore, publicKeyRetriever})
    this._attributeModel = attributeModel
    this._verificationModel = verificationModel
    this._getEthereumAccountByUri = getEthereumAccountByUri
  }

  async storeVerification({userId, attrType, attrId, verifierIdentity, linkedIdentities, signature}) {
    // linkedIdentites = linkedIdentites || {}
    // linkedIdentites.ethereum = linkedIdentites.ethereum &&
    //   await this._getEthereumAccountByUri(verifierIdentity)

    if (!this.checkVerification({userId, attrType, attrId, verifierIdentity, linkedIdentities, signature})) {
      return
    }

    const attribute = await this._attributeModel.findOne({where: {
      identityId: userId, type: attrType, key: attrId,
    }})
    const verification = await this._verificationModel.create({
      attributeId: attribute.id,
      identity: verifierIdentity,
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
      }
    })

    return verifications
  }
}
