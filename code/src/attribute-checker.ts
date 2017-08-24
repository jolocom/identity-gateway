import * as openpgp from 'openpgp'
import { GatewayIdentityStore } from './identity-store';
import { DataSigner } from './data-signer'
import { AttributeRetriever } from './attribute-verifier'
import { PublicKeyRetriever } from './verification-store'

export type VerificationsRetriever = ({sourceIdentitySignature, identity, attrType, attrId}) => Promise<Array<{id, verifierIdentity, signature}>>

export class AttributeChecker {
  private _attributeRetriever : AttributeRetriever
  private _publicKeyRetriever : PublicKeyRetriever
  private _dataSigner : DataSigner
  private _verificationsRetriever : VerificationsRetriever

  constructor({attributeRetriever, verificationsRetriever, publicKeyRetriever, dataSigner} :
              {attributeRetriever : AttributeRetriever,
               dataSigner : DataSigner,
               verificationsRetriever : VerificationsRetriever,
               publicKeyRetriever : PublicKeyRetriever})
  {
    this._attributeRetriever = attributeRetriever
    this._publicKeyRetriever = publicKeyRetriever
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
    const publicKeysAndVerifications = await Promise.all(verifications.map(verification => {
      const verifierIdentity = verification.verifierIdentity
      return this._publicKeyRetriever(verifierIdentity).then(publicKey => {
        return {publicKey, verification, verifierIdentityURL: verifierIdentity}
      })
    }))
    
    return await Promise.all(publicKeysAndVerifications.map(async ({
      publicKey, verification, verifierIdentityURL
    }) => {
      return {
        verificationId: verification.id,
        verifier: verifierIdentityURL,
        valid: (await openpgp.verify({
          message: new openpgp.cleartext.CleartextMessage(attrValue),
          signature: openpgp.signature.readArmored(verification.signature),
          publicKeys: openpgp.key.readArmored(publicKey).keys
        })).signatures[0].valid
      }
    }))
  }
}
