import { GatewayIdentityStore } from './identity-store';
import { DataSigner } from './data-signer'

export type AttributeRetriever = ({
  sourceIdentity, sourceIdentitySignature,
  identity, attrType, attrId
}) => Promise<string>

export type VerificationSender = ({
  sourceIdentity, sourceIdentitySignature,
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
    const sourceIdentitySignature = this._dataSigner.signData({data: sourceIdentity, seedPhrase})

    const retrievedAttribute = await this._attributeRetriever({
      sourceIdentity, sourceIdentitySignature, identity, attrType, attrId
    })
    // console.log(2, '!!!')
    if (retrievedAttribute !== attrValue) {
      return false
    }
    // console.log(3, '!!!')

    const signature = this._dataSigner.signData({data: retrievedAttribute, seedPhrase})
    // console.log(4, '!!!')
    await this._verificationSender({
      sourceIdentity, sourceIdentitySignature, identity, attrType, attrId, signature
    })
    // console.log(5, '!!!')
  }
}
