import { DataSigner } from './data-signer'

export type AttributeRetriever = ({identity, attrType, attrId}) => Promise<string>
export type VerificationSender = ({identity, attrType, attrId, signature}) => Promise<any>

export interface VerifierTransport {
  retrieveAttribute({identity, attrType, attrId}) : Promise<string>
  retrieveVerifications({identity, attrType, attrId})
  retrieveVerification({identity, attrType, attrId, verifierIdentity})
}

export class AttributeVerifier {
  private _attributeRetriever : AttributeRetriever
  private _dataSigner : DataSigner
  private _verificationSender : VerificationSender

  constructor({attributeRetriever, dataSigner, verificationSender} :
              {attributeRetriever : AttributeRetriever, dataSigner : DataSigner
               verificationSender : VerificationSender})
  {
    this._attributeRetriever = attributeRetriever
    this._dataSigner = dataSigner
    this._verificationSender = verificationSender
  }

  async verifyAttribute({seedPhrase, identity, attrType, attrId, attrValue} :
                        {seedPhrase : string, identity : string, attrType : string,
                         attrId : string, attrValue : string})
  {
    const retrievedAttribute = await this._attributeRetriever({identity, attrType, attrId})
    if (retrievedAttribute !== attrValue) {
      return false
    }

    const signature = this._dataSigner.signData({data: retrievedAttribute, seedPhrase})
    return await this._verificationSender({identity, attrType, attrId, signature})
  }
}
