import * as openpgp from 'openpgp'
import * as CustomStrategy from 'passport-custom'

export function createCustomStrategy({identityStore}) {
  return new CustomStrategy(async (req, callback) => {
    if (req.body.identity) {
      const valid = await authenticateExternalIdentity({
        identity: req.body.identity, signature: req.body.signature,
        publicKeyRetriever: this._publicKeyRetriever
      })

      callback(null, valid && {
        identity: req.body.identity
      })
    } else {
      const userId = await identityStore.getUserIdBySeedPhrase(req.body.seedPhrase)
      callback(null, userId && {id: userId})
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
  const armoredPublicKey = this._publicKeyRetriever(identity)
  const result = await openpgp.verify({
    message: openpgp.cleartext.readArmored(identity),
    signature: openpgp.signature.readArmored(signature),
    publicKeys: openpgp.key.readArmored(armoredPublicKey).keys
  })
  return result.signatures[0].valid
}
