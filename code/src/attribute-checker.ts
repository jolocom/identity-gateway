import * as openpgp from 'openpgp'
import * as stringify from 'json-stable-stringify'
import { GatewayIdentityStore } from './identity-store';
import { DataSigner } from './data-signer'
import { AttributeRetriever } from './attribute-verifier'
import { PublicKeyRetrievers } from './verification-store'

export type VerificationsRetriever = ({
  sourceIdentitySignature, identity, attrType, attrId
}) => Promise<Array<{id, verifierIdentity, linkedIdentities, signature}>>

export class AttributeChecker {
  private _attributeRetriever : AttributeRetriever
  private _publicKeyRetrievers : PublicKeyRetrievers
  private _dataSigner : DataSigner
  private _verificationsRetriever : VerificationsRetriever

  constructor({attributeRetriever, verificationsRetriever, publicKeyRetrievers, dataSigner} :
              {attributeRetriever : AttributeRetriever,
               dataSigner : DataSigner,
               verificationsRetriever : VerificationsRetriever,
               publicKeyRetrievers : PublicKeyRetrievers})
  {
    this._attributeRetriever = attributeRetriever
    this._publicKeyRetrievers = publicKeyRetrievers
    this._dataSigner = dataSigner
    this._verificationsRetriever = verificationsRetriever
  }

  async checkAttribute({sourceIdentity, seedPhrase,
                        identity, attrType, attrId, attrValue} :
                       {sourceIdentity : string, seedPhrase : string,
                        identity : string, attrType : string,
                        attrId : string, attrValue : string})
  {
    const sourceIdentitySignature = await this._dataSigner.signData({data: sourceIdentity, seedPhrase})
    const verifications = await this._verificationsRetriever({
      sourceIdentitySignature, identity, attrType, attrId
    })

    const publicKeysAndVerifications = await Promise.all(verifications.map(async verification => {
      const verifierIdentityURL = verification.verifierIdentity

      let publicKey
      if (verification.linkedIdentities.ethereum) {
        publicKey = await this._publicKeyRetrievers.ethereum(
          verifierIdentityURL, verification.linkedIdentities.ethereum
        )
      } else {
        publicKey = await this._publicKeyRetrievers.url(verifierIdentityURL)
      }
      
      let serialized
      try {
        serialized = stringify(JSON.parse(attrValue))
        //attribute merged with metadata
      } catch(e) {
        serialized = attrValue
      }
      
      return {
        verificationId: verification.id,
        verifier: verifierIdentityURL,
        valid: (await openpgp.verify({
          message: new openpgp.cleartext.CleartextMessage(serialized),
          signature: openpgp.signature.readArmored(verification.signature),
          publicKeys: openpgp.key.readArmored(publicKey).keys
        })).signatures[0].valid
      }
    }))
  }
}
