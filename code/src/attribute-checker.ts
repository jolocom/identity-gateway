import { GatewayIdentityStore } from './identity-store';
import { DataSigner } from './data-signer'

export class AttributeChecker {
  // private _attributeRetriever : AttributeRetriever
  // private _dataSigner : DataSigner
  // private _verificationSender : VerificationSender

  constructor({} :
              {})
  {
    // this._attributeRetriever = attributeRetriever
    // this._dataSigner = dataSigner
    // this._verificationSender = verificationSender
  }

  async checkAttribute({sourceIdentity,
                         identity, attrType, attrId, attrValue} :
                        {sourceIdentity : string,
                         identity : string, attrType : string,
                         attrId : string, attrValue : string})
  {
    
  }
}
