import * as _ from 'lodash'
import * as moment from 'moment'
const bodyParser = require('body-parser')
const express = require('express')
const OAuthServer = require('express-oauth-server')
import { OAuthModel } from './oauth';
import { AccessRights } from './access-rights'
import { GatewayIdentityStore } from './identity-store'
import { GatewayIdentityCreator } from './identity-creators'
import { AttributeStore } from './attribute-store'
import { VerificationStore } from './verification-store'
import { AttributeVerifier } from './attribute-verifier'

export function createApp({oAuthModel, accessRights, identityStore,
                           identityCreator, attributeStore, verificationStore,
                           attributeVerifier} :
                          {oAuthModel : OAuthModel, accessRights : AccessRights,
                           identityStore : GatewayIdentityStore,
                           identityCreator : GatewayIdentityCreator,
                           attributeStore : AttributeStore,
                           verificationStore : VerificationStore,
                           attributeVerifier : AttributeVerifier})
{
  const app = express()
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(bodyParser.json())
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next()
  })
  app.oauth = new OAuthServer({
    model: oAuthModel,
  });
  app.all('/oauth/token', app.oauth.grant())

  app.get('/:userName', async (req, res) => {
    res.json({publicKey: (await identityStore.getPublicKeyByUserName(req.params.userName))})
  })
  app.put('/:userName', async (req, res) => {
    await identityCreator.createIdentity({
      userName: req.params.userName, seedPhrase: req.params.seedPhrase
    })
    res.send('OK')
  })

  const protectedRoutes = {
    // '/:userName/access': {
    //   get: async (req, res) => {

    //   }
    // },
    '/:userName/access/grant': {
      post: async (req, res) => {
        await accessRights.grant({
          userID: req.user.id,
          identity: req.body.identity,
          oneTimeToken: req.body.oneTimeToken,
          pattern: req.body.pattern,
          read: req.body.read,
          write: req.body.write,
          expiryDate: req.body.expiryDate && moment(req.body.expiryDate)
        })
        res.send('OK')
      }
    },
    // '/:userName/access/revoke': {
    //   post: async (req, res) => {

    //   }
    // },
    '/:userName/identity/:attribute': {
      get: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.params.userName)
        res.json(await attributeStore.listAttributes({
          userId, type: req.params.attribute
        }))
      }
    },
    '/:userName/identity/:attribute/:id': {
      get: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.params.userName)
        res.json(await attributeStore.retrieveStringAttribute({
          userId, type: req.params.attribute, id: req.params.id
        }))
      },
      put: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.params.userName)
        await attributeStore.storeStringAttribute({
          userId, type: req.params.attribute, id: req.params.id, value: req.body
        })
        res.send('OK')
      }
    },
    '/:userName/identity/:attribute/:id/verifications': {
      get: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.params.userName)
        res.json(await verificationStore.getVerifications({
          userId, attrType: req.params.attribute, attrId: req.params.id
        }))
      }
    },
    '/:userName/identity/:attribute/:id/verifications/:id': {
      get: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.params.userName)
        res.json(await verificationStore.getVerification({
          userId, attrType: req.params.attribute, attrId: req.params.id,
          verificationId: req.params.id
        }))
      },
      put: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.params.userName)
        await verificationStore.storeVerification({
          userId, attrType: req.params.attribute, attrId: req.params.id,
          verifierIdentity: req.client.id, signature: req.body
        })
        res.send('OK')
      }
    },
    '/:userName/sign': {
      post: async (req, res) => {
        attributeVerifier.verifyAttribute({
          seedPhrase: req.body.seedPhrase,
          attrType: req.body.attributeType, attrId: req.body.attributeId,
          attrValue: req.body.attributeValue,
          identity: req.body.identity
        })
        res.send('OK')
      }
    },
  }

  _.each(protectedRoutes, (methods, path) => {
    _.each(methods, (func, method) => {
      app[method]('/', app.oauth.authorise(), accessRightsMiddleware({
        accessRights, identityStore
      }), func)
    })
  })

  return app
}

export function accessRightsMiddleware({accessRights, identityStore} :
                                       {accessRights : AccessRights,
                                        identityStore : GatewayIdentityStore})
{
  return async (req, res, next) => {
    const userID = await identityStore.getUserIdByUserName(req.params.userName)
    if (req.user.id === userID) {
      return next()
    }
    if (req.client && await accessRights.check({userID, identity: req.client, path: req.path})) {
      return next()
    }
    res.status(403).send('Access denied')
  }
}
