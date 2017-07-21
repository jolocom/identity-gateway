import * as openpgp from 'openpgp'
import { AttributeStore } from './attribute-store';

export type PublicKeyRetriever = (string) => Promise<string>

export abstract class VerificationStore {
  private _attributeStore : AttributeStore
  private _publicKeyRetriever : PublicKeyRetriever

  constructor({attributeStore, publicKeyRetriever} :
              {attributeStore : AttributeStore, publicKeyRetriever : PublicKeyRetriever})
  {
    this._attributeStore = attributeStore
    this._publicKeyRetriever = publicKeyRetriever
  }

  abstract storeVerification({userId, attrType, attrId, verifierIdentity, signature})
  abstract getVerifications({userId, attrType, attrId})
  abstract getVerification({userId, attrType, attrId, verificationId})

  protected async checkVerification({
    userId, attrType, attrId,
    verifierIdentity, signature
  }) {
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

  async storeVerification({userId, attrType, attrId, verifierIdentity, signature}) {
    if (!this.checkVerification({userId, attrType, attrId, verifierIdentity, signature})) {
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

    const verificationId = Date.now()
    attrVerifications[verificationId] = {verifierIdentity, signature}
  }

  async getVerifications({userId, attrType, attrId}) {
    const userVerifications = this._verfications[userId]
    const verificationsKey = `${attrType}_${attrId}`
    const attrVerifications = userVerifications[verificationsKey]
    return attrVerifications
  }

  async getVerification({userId, attrType, attrId, verificationId}) {
    return this.getVerifications({userId, attrType, attrId})[verificationId]
  }
}
