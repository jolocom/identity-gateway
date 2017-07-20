import { DataSigner } from './data-signer'

export interface AttributeRetriever {
  retrieve({identity, attrType, attrId}) : Promise<string>
}

export interface VerificationStore {
  store({identity, attrType, attrId, signature}) : Promise<any>
}

export class AttributeVerifier {
  private _attributeRetriever : AttributeRetriever
  private _dataSigner : DataSigner
  private _verificationStore : VerificationStore

  constructor({attributeRetriever, dataSigner, verificationStore} :
              {attributeRetriever : AttributeRetriever, dataSigner : DataSigner
               verificationStore : VerificationStore})
  {
    this._attributeRetriever = attributeRetriever
    this._dataSigner = dataSigner
    this._verificationStore = verificationStore
  }

  async verifyAttribute({seedPhrase, identity, attrType, attrId, attrValue} :
                        {seedPhrase : string, identity : string, attrType : string,
                         attrId : string, attrValue : string})
  {
    const retrievedAttribute = await this._attributeRetriever.retrieve({identity, attrType, attrId})
    if (retrievedAttribute !== attrValue) {
      return false
    }

    const signature = this._dataSigner.signData({data: retrievedAttribute, seedPhrase})
    return await this._verificationStore.store({identity, attrType, attrId, signature})
  }
}
