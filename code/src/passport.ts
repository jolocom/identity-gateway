import { GatewayIdentityStore } from './identity-store';
import * as openpgp from 'openpgp'
import * as CustomStrategy from 'passport-custom'
import { PublicKeyRetrievers } from './verification-store'

export type IdentityUrlBuilder = ({userName, req}) => string

export function createCustomStrategy({identityStore, identityUrlBuilder, publicKeyRetrievers} :
                                     {identityStore : GatewayIdentityStore,
                                      identityUrlBuilder : IdentityUrlBuilder,
                                      publicKeyRetrievers : PublicKeyRetrievers}) {
  return new CustomStrategy(async (req, callback) => {
    if (req.body.identity) {
      const valid = await authenticateExternalIdentity({
        identity: req.body.identity, signature: req.body.signature,
        publicKeyRetrievers
      })

      callback(null, valid && {
        identity: req.body.identity
      })
    } else {
      const user = await identityStore.getUserBySeedPhrase(req.body.seedPhrase)
      callback(null, user && {
        id: user.id,
        userName: user.userName,
        identity: identityUrlBuilder({userName: user.userName, req})
      })
    }
  })
}

export function setupSessionSerialization(passport, {sessionStore}) {
  passport.serializeUser(async function(user, done) {
    done(null, await sessionStore.serializeUser(user))
  });

  passport.deserializeUser(async function(sessionId, done) {
    done(null, await sessionStore.deserializeUser(sessionId))
  });
}

export async function authenticateExternalIdentity(
  {identity, signature, publicKeyRetrievers} :
  {identity : string, signature : string, publicKeyRetrievers : PublicKeyRetrievers}
) {
  const identityCleartext = openpgp.cleartext.readArmored(identity)
  const identityURL = identityCleartext.text
  const armoredPublicKey = await publicKeyRetrievers.url(identityURL)
  // console.log(' | ', identity, ' | ', signature, ' | ', armoredPublicKey)
  const result = await openpgp.verify({
    message: identityCleartext,
    signature: openpgp.signature.readArmored(signature),
    publicKeys: openpgp.key.readArmored(armoredPublicKey).keys
  })
  return result.signatures[0].valid
}
