import * as _ from 'lodash'
import * as moment from 'moment'
const bodyParser = require('body-parser')
const express = require('express')
const request = require('request');
const session = require('express-session')
const uuid = require('uuid/v1')
import * as passport from 'passport'
import * as URL from 'url-parse'
import { AccessRights } from './access-rights'
import { GatewayIdentityStore } from './identity-store'
import { GatewayIdentityCreator } from './identity-creators'
import { AttributeStore } from './attribute-store'
import { VerificationStore } from './verification-store'
import { AttributeVerifier } from './attribute-verifier'
import { AttributeChecker } from './attribute-checker'
import { SessionStore } from './session-store'
import { IdentityUrlBuilder, createCustomStrategy, setupSessionSerialization } from './passport'

export function createApp({accessRights, identityStore, identityUrlBuilder,
                           identityCreator, attributeStore, verificationStore,
                           attributeVerifier, attributeChecker, sessionStore, publicKeyRetriever} :
                          {accessRights : AccessRights,
                           identityStore : GatewayIdentityStore,
                           identityUrlBuilder : IdentityUrlBuilder,
                           identityCreator : GatewayIdentityCreator,
                           attributeStore : AttributeStore,
                           verificationStore : VerificationStore,
                           attributeVerifier : AttributeVerifier,
                           attributeChecker : AttributeChecker,
                           publicKeyRetriever : (string) => Promise<string>,
                           sessionStore : SessionStore})
{
const app = express()
  app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
  }))
  app.use(passport.initialize())
  app.use(passport.session())
  app.use('/proxy/', accessRightsMiddleware({ accessRights, identityStore }),
    async (req, res) => {
      const destination = req.query.url
      const sourceIdentity = req.user.identity

      const cookieJar = request.jar()
      const reqst = request.defaults({jar: cookieJar})

      await reqst({
        method: 'POST',
        uri: new URL(destination).origin + '/login',
        body: JSON.stringify({"identity": sourceIdentity})
      })
      req.pipe(request({ qs:req.query, uri: req.query.url })).pipe(res);
  })

  app.use(bodyParser.urlencoded({extended: true}))
  app.use(bodyParser.json())
  app.use(bodyParser.text())
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.get('Origin'))
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
    res.header("Access-Control-Allow-Credentials", "true")
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS")
    next()
  })
  passport.use('custom', createCustomStrategy({identityStore, identityUrlBuilder, publicKeyRetriever}))
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
      const publicKey = await identityStore.getPublicKeyByUserName(req.params.userName)
      if (publicKey) {
        res.json({publicKey})
      } else {
        res.status(404).send('User not found')
      }
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
        const body = req.body
        const patterns = typeof body.pattern === 'string'
          ? [body.pattern] : body.pattern

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
      },
      put: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.params.userName)
        await attributeStore.storeStringAttribute({
          userId, type: req.params.attribute, id: uuid(),
          value: typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
        })
        res.send('OK')
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
          verifierIdentity: req.user.identity, signature: req.body
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
    '/:userName/verify': {
      post: async (req, res) => {
        await attributeVerifier.verifyAttribute({
          sourceIdentity: req.user.identity,
          seedPhrase: req.body.seedPhrase,
          attrType: req.body.attributeType,
          attrId: req.body.attributeId,
          attrValue: JSON.stringify(req.body.attributeValue),
          identity: req.body.identity
        })
        res.send('OK')
      }
    },
    '/:userName/check': {
      post: async (req, res) => {
        res.json(await attributeChecker.checkAttribute({
          sourceIdentity: req.user.identity,
          seedPhrase: req.body.seedPhrase,
          attrType: req.body.attributeType,
          attrId: req.body.attributeId,
          attrValue: JSON.stringify(req.body.attributeValue),
          identity: req.body.identity
        }))
      }
    }
  }

  app.post('/login',
    passport.authenticate('custom', { failureRedirect: '/login' }),
    function(req, res) {
      res.json({userName: req.user.userName})
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
