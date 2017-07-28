import * as _ from 'lodash'
import * as moment from 'moment'
const bodyParser = require('body-parser')
const express = require('express')
const session = require('express-session')
import * as passport from 'passport'
import { AccessRights } from './access-rights'
import { GatewayIdentityStore } from './identity-store'
import { GatewayIdentityCreator } from './identity-creators'
import { AttributeStore } from './attribute-store'
import { VerificationStore } from './verification-store'
import { AttributeVerifier } from './attribute-verifier'
import { SessionStore } from './session-store';
import { createCustomStrategy, setupSessionSerialization } from './passport';

export function createApp({accessRights, identityStore,
                           identityCreator, attributeStore, verificationStore,
                           attributeVerifier, sessionStore} :
                          {accessRights : AccessRights,
                           identityStore : GatewayIdentityStore,
                           identityCreator : GatewayIdentityCreator,
                           attributeStore : AttributeStore,
                           verificationStore : VerificationStore,
                           attributeVerifier : AttributeVerifier,
                           sessionStore : SessionStore})
{
  const app = express()
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(bodyParser.json())
  app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
  }))
  app.use(passport.initialize())
  app.use(passport.session())
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next()
  })
  passport.use('custom', createCustomStrategy({identityStore}))
  setupSessionSerialization(passport, {sessionStore})
  // app.use(async (req, res, next) => {
  //   try {
  //     console.log(111)
  //     const res = next()
  //     if (res && res.then) {
  //       await res
  //     }
  //     console.log(222)
  //   } catch(e) {
  //     console.error(e)
  //     console.trace()
  //   }
  // })
  
  app.get('/:userName', async (req, res) => {
    try {
      res.json({publicKey: (await identityStore.getPublicKeyByUserName(req.params.userName))})
    } catch(e) {
      console.error(e)
      console.trace()
    }
  })
  app.put('/:userName', async (req, res) => {
    try {
      await identityCreator.createIdentity({
        userName: req.params.userName, seedPhrase: req.body.seedPhrase
      })
    } catch(e) {
      console.error(e)
      console.trace()
    }
    res.send('OK')
  })

  const protectedRoutes = {
    // '/:userName/access': {
    //   get: async (req, res) => {

    //   }
    // },
    '/:userName/access/grant': {
      post: async (req, res) => {
        const patterns = typeof req.body.pattern === 'string'
          ? [req.body.pattern] : req.body.pattern

        await Promise.all(patterns.map(async pattern => {
          await accessRights.grant({
            userID: req.user.id,
            identity: req.body.identity,
            oneTimeToken: req.body.oneTimeToken,
            pattern: req.body.pattern,
            read: req.body.read,
            write: req.body.write,
            expiryDate: req.body.expiryDate && moment(req.body.expiryDate)
          })
        }))
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
        res.json(JSON.parse((await attributeStore.retrieveStringAttribute({
          userId, type: req.params.attribute, id: req.params.id
        })).value))
      },
      put: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.params.userName)
        await attributeStore.storeStringAttribute({
          userId, type: req.params.attribute, id: req.params.id,
          value: typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
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
      },
      put: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.params.userName)
        const verificationId = await verificationStore.storeVerification({
          userId, attrType: req.params.attribute, attrId: req.params.id,
          verifierIdentity: req.client.id, signature: req.body
        })
        res.json({verificationId})
      }
    },
    '/:userName/identity/:attribute/:id/verifications/:id': {
      get: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.params.userName)
        res.json(await verificationStore.getVerification({
          userId, attrType: req.params.attribute, attrId: req.params.id,
          verificationId: req.params.id
        }))
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

  app.post('/login',
    passport.authenticate('custom', { failureRedirect: '/login' }),
    function(req, res) {
      res.send('OK')
    }
  )

  _.each(protectedRoutes, (methods, path) => {
    _.each(methods, (func, method) => {
      app[method](path, accessRightsMiddleware({
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
    if (!req.isAuthenticated()) {
      return res.status(401).send('Not allowed')
    }

    const userID = await identityStore.getUserIdByUserName(req.params.userName)
    if (req.user.id === userID) {
      return next()
    }
    if (req.client && await accessRights.check({userID, identity: req.user.identity, path: req.path})) {
      return next()
    }
    res.status(403).send('Access denied')
  }
}
