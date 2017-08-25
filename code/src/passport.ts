import { GatewayIdentityStore } from './identity-store';
import * as openpgp from 'openpgp'
import * as CustomStrategy from 'passport-custom'
import { PublicKeyRetrievers } from './verification-store'

export type IdentityUrlBuilder = ({userName}) => string

export function createCustomStrategy({identityStore, identityUrlBuilder, publicKeyRetrievers} :
                                     {identityStore : GatewayIdentityStore,
                                      identityUrlBuilder : IdentityUrlBuilder,
                                      publicKeyRetrievers : PublicKeyRetrievers}) {
  return new CustomStrategy(async (req, callback) => {
    if (req.body.identity) {
      const identityURL = await authenticateExternalIdentity({
        identity: req.body.identity, signature: req.body.signature,
        publicKeyRetrievers
      })

      callback(null, identityURL && {
        identity: identityURL
      })
    } else {
      const user = await identityStore.getUserBySeedPhrase(req.body.seedPhrase)
      callback(null, user && {
        id: user.id,
        userName: user.userName,
        identity: identityUrlBuilder({userName: user.userName})
      })
    }
  })
}

export function setupSessionSerialization(passport, {identityStore, identityUrlBuilder}) {
  passport.serializeUser(async function(user, done) {
    done(null, user.id ? `name:${user.userName}` : `uri:${user.identity}`)
  });

  passport.deserializeUser(async function(serialized, done) {
    let user
    if (serialized.indexOf('name:') === 0) {
      const userName = serialized.substr('name:'.length)
      let userId
      try {
        userId = await identityStore.getUserIdByUserName(userName)
        if (!userId) {
          throw new Error('User not found: ' + userName)
        }
      } catch(e) {
        done(e)
      }
      user = {
        id: userId,
        userName: userName,
        identity: identityUrlBuilder({userName})
      }
    } else if (serialized.indexOf('uri:') === 0) {
      user = {
        identity: serialized.substr('uri:'.length)
      }
    } else {
      throw new Error('Failed deserializing session')
    }
    done(null, user)
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
  return result.signatures[0].valid ? identityURL : null
}
