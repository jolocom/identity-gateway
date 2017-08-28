import { DataSigner } from './data-signer';
import * as _ from 'lodash'
import * as moment from 'moment'
const bodyParser = require('body-parser')
const express = require('express')
const passportSocketIo = require('passport.socketio')
const request = require('request');
const session = require('express-session')
const uuid = require('uuid/v1')
const cookieParser = require('cookie-parser')
import * as passport from 'passport'
import * as URL from 'url-parse'
import { AccessRights } from './access-rights'
import { GatewayIdentityStore } from './identity-store'
import { GatewayIdentityCreator, EthereumIdentityCreator } from './identity-creators'
import { AttributeStore } from './attribute-store'
import { VerificationStore, PublicKeyRetrievers } from './verification-store'
import { AttributeVerifier } from './attribute-verifier'
import { AttributeChecker } from './attribute-checker'
// import { SessionStore } from './session-store'
import { IdentityUrlBuilder, createCustomStrategy, setupSessionSerialization } from './passport'
import { EthereumInteraction } from './ethereum-interaction'
import { stringToBoolean } from './utils'

export function createApp({accessRights, identityStore, identityUrlBuilder,
                           identityCreator, ethereumIdentityCreator,
                           attributeStore, verificationStore,
                           attributeVerifier, attributeChecker,
                           publicKeyRetrievers,
                           expressSessionStore, sessionSecret,
                           dataSigner,
                           ethereumInteraction, getEthereumAccountByUserId} :
                          {accessRights : AccessRights,
                           identityStore : GatewayIdentityStore,
                           identityUrlBuilder : IdentityUrlBuilder,
                           identityCreator : GatewayIdentityCreator,
                           ethereumIdentityCreator : EthereumIdentityCreator,
                           attributeStore : AttributeStore,
                           verificationStore : VerificationStore,
                           attributeVerifier : AttributeVerifier,
                           attributeChecker : AttributeChecker,
                           publicKeyRetrievers : PublicKeyRetrievers,
                           expressSessionStore,
                           sessionSecret : string,
                           dataSigner : DataSigner,
                           ethereumInteraction: EthereumInteraction,
                           getEthereumAccountByUserId : (string) => Promise<{
                             walletAddress : string,
                             identityAddress : string,
                           }>,
                          })
{
const app = express()
  app.use(session({
    secret: sessionSecret,
    store: expressSessionStore,
    resave: false,
    saveUninitialized: true
  }))
  app.use(passport.initialize())
  app.use(passport.session())
  app.use('/proxy', accessRightsMiddleware({ accessRights, identityStore }),
    async (req, res) => {
      const destination = req.query.url
      const sourceIdentity = req.user.identity
      const sourceIdentitySignature = await dataSigner.signData({
        data: sourceIdentity, seedPhrase: req.query.seedPhrase
      })

      const cookieJar = request.jar()
      const reqst = request.defaults({jar: cookieJar})

      await reqst({
        method: 'POST',
        uri: new URL(destination).origin + '/login',
        form: {identity: sourceIdentitySignature.data, signature: sourceIdentitySignature.signature}
      })
      req.pipe(request({ qs: req.query, uri: req.query.url })).pipe(res)
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
  passport.use('custom', createCustomStrategy({identityStore, identityUrlBuilder, publicKeyRetrievers}))
  setupSessionSerialization(passport, {identityStore, identityUrlBuilder})
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
    '/:userName/access/revoke': {
      post: async (req, res) => {
        let read = stringToBoolean(req.body.read)
        let write = stringToBoolean(req.body.write)
        await accessRights.revoke({
          userID: req.user.id,
          identity: req.body.identity,
          pattern: req.body.pattern,
          read,
          write
        })
        res.send('OK')
      }
    },
    '/:userName/access': {
      get: async (req, res) => {
        let rules = await accessRights.list({
          userID: req.user.id
        })
        res.json(rules)
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
        const attribute = (await attributeStore.retrieveAttribute({
          userId, type: req.params.attribute, id: req.params.id
        }))
        if (attribute.dataType === 'string') {
          res.send(attribute.value)
        } else {
          res.json(attribute.value)
        }
      },
      put: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.params.userName)
        const isString = typeof req.body === 'string'
        const params = {
          userId, type: req.params.attribute, id: req.params.id,
          value: req.body
        }
        if (isString) {
          await attributeStore.storeStringAttribute(params)
        } else {
          await attributeStore.storeJsonAttribute(params)
        }
        res.send('OK')
      },
      delete: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.params.userName)
        await attributeStore.deleteAttribute({
          userId, type: req.params.attribute, id: req.params.id
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
          verifierIdentity: req.user.identity,
          linkedIdentities: req.body.linkedIdentities,
          signature: req.body.signature
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
          sourceUserId: req.user.id,
          seedPhrase: req.body.seedPhrase,
          attrType: req.body.attributeType,
          attrId: req.body.attributeId,
          attrValue: req.body.attributeValue,
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
          attrValue: req.body.attributeValue,
          identity: req.body.identity
        }))
      }
    },
    '/:userName/ethereum/create-identity': {
      post: async (req, res) => {
        res.json(await ethereumIdentityCreator.createIdentity({
          userId: req.user.id,
          seedPhrase: req.body.seedPhrase,
          publicKey: (await identityStore.getKeyPairBySeedPhrase(req.body.seedPhrase)).publicKey,
          identityURL: req.user.identity
        }))
      }
    },
    '/:userName/ethereum': {
      get: async (req, res) => {
        res.json(await getEthereumAccountByUserId(req.user.id))
      }
    },
    '/:userName/ethereum/get-balance': {
      post: async (req, res) => {
        res.json({
          ether: await ethereumInteraction.getEtherBalance({walletAddress: req.body.walletAddress})
        })
      }
    },
    '/:userName/ethereum/send-ether': {
      post: async (req, res) => {
        await ethereumInteraction.sendEther({
          seedPhrase: req.body.seedPhrase,
          receiver: req.body.receiver,
          amountEther: req.body.amountEther,
          data: req.body.data,
          gasInWei: req.body.gasInWei
        })
        res.send('OK')
      }
    }
  }

  app.post('/login', function(req, res, next) {
    passport.authenticate('custom', function(err, user, info) {
      if (err) {
        return next(err)
      }
      if (!user) {
        return res.json({success: false})
      }
      
      req.logIn(user, function(err) {
        if (err) {
          return next(err)
        }
        return res.json({success: true, userName: user.userName})
      });
    })(req, res, next);
  });
  
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

export function createSocketIO({server, sessionSecret, sessionStore, verificationStore}) {
  const io = require('socket.io')(server)
  io.use(passportSocketIo.authorize({
    key: 'connect.sid',
    secret: sessionSecret,
    store: sessionStore,
    passport,
    cookieParser: cookieParser
  }));

  const clients = {}
  io.on('connection', function(client) {
    console.log('Client connected...', client.request.user)

    // client.on('join', function(data) {
    //     console.log(data)
    // })
  })

  return io
}
