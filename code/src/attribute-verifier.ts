import { GatewayIdentityStore } from './identity-store';
import { DataSigner } from './data-signer'

export type AttributeRetriever = ({
  sourceIdentitySignature,
  identity, attrType, attrId
}) => Promise<string>

export type VerificationSender = ({
  sourceIdentitySignature,
  identity, attrType, attrId,
  signature
}) => Promise<any>

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

  async verifyAttribute({seedPhrase, sourceIdentity,
                         identity, attrType, attrId, attrValue} :
                        {seedPhrase : string, sourceIdentity : string,
                         identity : string, attrType : string,
                         attrId : string, attrValue : string})
  {
    const sourceIdentitySignature = await this._dataSigner.signData({data: sourceIdentity, seedPhrase})

    const retrievedAttribute = await this._attributeRetriever({
      sourceIdentitySignature, identity, attrType, attrId
    })
    if (retrievedAttribute !== attrValue) {
      return false
    }
    
    const signature = await this._dataSigner.signData({data: retrievedAttribute, seedPhrase})
    await this._verificationSender({
      sourceIdentitySignature, identity, attrType, attrId, signature
    })
  }
}
