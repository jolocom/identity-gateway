import { GatewayIdentityStore } from './identity-store';
import * as openpgp from 'openpgp'
import * as CustomStrategy from 'passport-custom'

export type IdentityUrlBuilder = ({userName, req}) => string

export function createCustomStrategy({identityStore, identityUrlBuilder, publicKeyRetriever} :
                                     {identityStore : GatewayIdentityStore,
                                      identityUrlBuilder : IdentityUrlBuilder,
                                      publicKeyRetriever : (string) => Promise<string>}) {
  return new CustomStrategy(async (req, callback) => {
    if (req.body.identity) {
      const valid = await authenticateExternalIdentity({
        identity: req.body.identity, signature: req.body.signature,
        publicKeyRetriever: publicKeyRetriever
      })

      callback(null, valid && {
        identity: req.body.identity
      })
    } else {
      const user = await identityStore.getUserBySeedPhrase(req.body.seedPhrase)
      callback(null, user && {
        id: user.id,
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

export async function authenticateExternalIdentity({identity, signature, publicKeyRetriever}) {
  const armoredPublicKey = publicKeyRetriever(identity)
  const result = await openpgp.verify({
    message: openpgp.cleartext.readArmored(identity),
    signature: openpgp.signature.readArmored(signature),
    publicKeys: openpgp.key.readArmored(armoredPublicKey).keys
  })
  return result.signatures[0].valid
}
