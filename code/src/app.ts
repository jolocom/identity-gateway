import { SocketClientMap } from './socket-client-map';
import { VerificationEventDispatcher } from './verification-event-dispatcher';
import { EtherBalanceDispatcher } from './ether-balance-watcher';
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
import { InviteStore } from './invite-store';
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
                           inviteStore,
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
                           inviteStore : InviteStore,
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
  app.use('/proxy',
    async (req, res) => {
      if (!req.isAuthenticated() || !req.user.id) {
        return res.status(401).send('Not allowed')
      }

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
      const success = await identityCreator.createIdentity({
        userName: req.params.userName, seedPhrase: req.body.seedPhrase,
        overrideWalletAddress: req.body.overrideWalletAddress,
        inviteCode: req.body.inviteCode
      })
      if (success) {
        res.send('OK')
      } else {
        res.status(403).send('Forbidden')
      }
    } catch(e) {
      console.error(e)
      console.trace()
    }
  })

  app.post('/registration/create-invite', async (req, res) => {
    if (!req.user || !req.user.id) {
      res.status(403).send('Forbidden')
      return
    }

    res.json({
      code: await inviteStore.generate({})
    })
  })

  const protectedRoutes = {
    // /access': {
    //   get: async (req, res) => {

    //   }
    // },
    '/access/grant': {
      post: async (req, res) => {
        const body = req.body
        const patterns = typeof body.pattern === 'string'
          ? [body.pattern] : body.pattern

        await Promise.all(patterns.map(async pattern => {
          await accessRights.grant({
            userID: req.user.id,
            identity: req.body.identity,
            oneTimeToken: req.body.oneTimeToken,
            pattern: pattern,
            read: req.body.read,
            write: req.body.write,
            expiryDate: req.body.expiryDate && moment(req.body.expiryDate)
          })
        }))
        res.send('OK')
      }
    },
    '/access/revoke': {
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
    '/access': {
      get: async (req, res) => {
        let rules = await accessRights.list({
          userID: req.user.id
        })
        res.json(rules)
      }
    },
    // '/access/revoke': {
    //   post: async (req, res) => {

    //   }
    // },
    '/identity/:attribute': {
      get: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.user.userName)
        res.json(await attributeStore.listAttributes({
          userId, type: req.params.attribute
        }))
      },
      put: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.user.userName)
        const isString = typeof req.body === 'string'
        const params = {
          userId, type: req.params.attribute, id: uuid(),
          value: req.body
        }
        if (isString) {
          await attributeStore.storeStringAttribute(params)
        } else {
          await attributeStore.storeJsonAttribute(params)
        }
        res.send('OK')
      }
    },
    '/identity/:attribute/:id': {
      get: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.user.userName)
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
        const userId = await identityStore.getUserIdByUserName(req.user.userName)
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
        const userId = await identityStore.getUserIdByUserName(req.user.userName)
        await attributeStore.deleteAttribute({
          userId, type: req.params.attribute, id: req.params.id
        })
        res.send('OK')
      }
    },
    '/identity/:attribute/:id/verifications': {
      get: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.user.userName)
        res.json(await verificationStore.getVerifications({
          userId, attrType: req.params.attribute, attrId: req.params.id
        }))
      },
      put: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.user.userName)
        const verificationId = await verificationStore.storeVerification({
          userId, attrType: req.params.attribute, attrId: req.params.id,
          verifierIdentity: req.user.identity,
          linkedIdentities: req.body.linkedIdentities,
          signature: req.body.signature
        })
        res.json({verificationId})
      }
    },
    '/identity/:attribute/:id/verifications/:id': {
      get: async (req, res) => {
        const userId = await identityStore.getUserIdByUserName(req.user.userName)
        res.json(await verificationStore.getVerification({
          userId, attrType: req.params.attribute, attrId: req.params.id,
          verificationId: req.params.id
        }))
      }
    },
    '/verify': {
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
    '/check': {
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
    '/ethereum/create-identity': {
      post: async (req, res) => {
        res.json(await ethereumIdentityCreator.createIdentity({
          userId: req.user.id,
          seedPhrase: req.body.seedPhrase,
          publicKey: (await identityStore.getKeyPairBySeedPhrase(req.body.seedPhrase)).publicKey,
          identityURL: req.user.identity
        }))
      }
    },
    '/ethereum': {
      get: async (req, res) => {
        res.json(await getEthereumAccountByUserId(req.user.id))
      }
    },
    '/ethereum/wallet-address': {
      get: async (req, res) => {
        res.send((await getEthereumAccountByUserId(req.user.id)).walletAddress)
      }
    },
    '/ethereum/identity-address': {
      get: async (req, res) => {
        res.send((await getEthereumAccountByUserId(req.user.id)).identityAddress)
      }
    },
    '/ethereum/get-balance': {
      post: async (req, res) => {
        res.json({
          ether: await ethereumInteraction.getEtherBalance({walletAddress: req.body.walletAddress})
        })
      }
    },
    '/ethereum/send-ether': {
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
    // path = path.replace('/:userName', '(?:/([A-Za-z0-9\-]+))?')
    path = '/:userName?' + path
    
    _.each(methods, (route, method) => {
      route = route.handler ? route : {handler: route}

      app[method](path, accessRightsMiddleware({
        accessRights, identityStore
      }), route.handler)
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

    const userName = req.params.userName || req.hostname.split('.')[0]
    const userID = await identityStore.getUserIdByUserName(userName)
    if (req.user.id === userID) {
      return next()
    }

    const checkPath = '/' + req.path.split('/').slice(2).join('/')
    const allowed = await accessRights.check({userID, identity: req.user.identity, path: checkPath})
    if (allowed.read && req.method === 'GET') {
      return next()
    } else if (allowed.write && ['POST', 'PUT'].indexOf(req.method) >= 0) {
      return next()
    }

    res.status(403).send('Access denied')
  }
}

export function createSocketIO({
  server, sessionSecret, sessionStore, verificationStore,
  etherBalanceWatcher
}) {
  const io = require('socket.io')(server)
  io.use(passportSocketIo.authorize({
    key: 'connect.sid',
    secret: sessionSecret,
    store: sessionStore,
    passport,
    cookieParser: cookieParser
  }));

  const socketClientMap = new SocketClientMap()
  socketClientMap.setup({io})

  const etherBalanceDispatcher = new EtherBalanceDispatcher({etherBalanceWatcher})
  etherBalanceDispatcher.setup({io, clients: socketClientMap.clients})

  const verificationEventDispatcher = new VerificationEventDispatcher()
  verificationEventDispatcher.setup({clients: socketClientMap.clients, verificationStore})

  return io
}
