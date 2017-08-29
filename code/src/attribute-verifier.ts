import * as _ from 'lodash'
import { GatewayIdentityStore } from './identity-store';
import { DataSigner } from './data-signer'
import * as stringify from 'json-stable-stringify'

export type AttributeRetriever = ({
  sourceIdentitySignature,
  identity, attrType, attrId
}) => Promise<string>

export type VerificationSender = ({
  sourceIdentitySignature, sourceLinkedIdentities,
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
  private _identityStore : GatewayIdentityStore

  constructor({attributeRetriever, dataSigner, verificationSender, identityStore} :
              {attributeRetriever : AttributeRetriever, dataSigner : DataSigner
               verificationSender : VerificationSender,
               identityStore : GatewayIdentityStore})
  {
    this._attributeRetriever = attributeRetriever
    this._dataSigner = dataSigner
    this._verificationSender = verificationSender
    this._identityStore = identityStore
  }

  async verifyAttribute({seedPhrase, sourceIdentity, sourceUserId,
                         identity, attrType, attrId, attrValue} :
                        {seedPhrase : string,
                         sourceIdentity : string, sourceUserId : string,
                         identity : string, attrType : string,
                         attrId : string, attrValue : string})
  {
    const sourceIdentitySignature = await this._dataSigner.signData({data: sourceIdentity, seedPhrase})
    const hasEthereum = !!(await this._identityStore.getLinkedIdentity({
      userId: sourceUserId, type: 'ethereum:identity'
    }))
    
    const retrievedAttribute = await this._attributeRetriever({
      sourceIdentitySignature, identity, attrType, attrId
    })
    const attrIsString = typeof retrievedAttribute === 'string'
    if (attrIsString) {
      if (retrievedAttribute !== attrValue) {
        return false
      }
    } else {
      if (typeof attrValue === "string") {
        attrValue = JSON.parse(attrValue)
      }
      if (!_.isEqual(retrievedAttribute, attrValue)) {
        return false
      }
    }

    const serialized = !attrIsString ? stringify(retrievedAttribute) : retrievedAttribute
    
    const signature = await this._dataSigner.signData({data: serialized, seedPhrase})
    await this._verificationSender({
      sourceIdentitySignature, identity, attrType, attrId, signature,
      sourceLinkedIdentities: {ethereum: hasEthereum}
    })
  }
}
