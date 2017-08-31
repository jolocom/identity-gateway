import * as moment from 'moment'
import { expect } from 'chai'
import { MemoryAccessRights, SequelizeAccessRights } from './access-rights'
import * as Sequelize from 'sequelize'
import { initSequelize } from './sequelize/utils'

function testAccessRights(env) {
  let accessRights

  beforeEach(() => {
    accessRights = env.accessRights
  })

  it('should be able to modify and test access rights', async () => {
    await accessRights.grant({
      userID: env.testUserID, identity: 'https://identity.test.com', pattern: '/identity/passport/*',
      read: true, write: false
    })
    await accessRights.grant({
      userID: env.testUserID, identity: 'https://identity.test.com', pattern: '/identity/passport/holland',
      read: true, write: true
    })
    expect(await accessRights.check({
      userID: env.testUserID, identity: 'https://identity.test.com', path: '/identity/passport/greece'
    })).to.deep.equal({
      read: true, write: false
    })
  })

  it('should be able to grant temporary access', async () => {
    await accessRights.grant({
      userID: env.testUserID, identity: 'https://identity.test.com', pattern: '/identity/passport/*',
      read: true, write: false, expiryDate: moment(accessRights._getNow()).add(1, 'hour'), oneTimeToken: 'test'
    })
    expect(await accessRights.check({
      userID: env.testUserID, identity: 'https://identity.test.com',
      path: '/identity/passport/holland', oneTimeToken: 'test'
    })).to.deep.equal({
      read: true, write: false
    })
    expect(await accessRights.check({
      userID: env.testUserID, identity: 'https://identity.test.com', path: '/identity/passport/holland'
    })).to.deep.equal({read: false, write: false})

    await accessRights.grant({
      userID: env.testUserID, identity: 'https://identity.test.com',
      pattern: '/identity/passport/holland/verifications/jolocom',
      read: true, write: false, expiryDate: accessRights._getNow().subtract(1, 'hour'), oneTimeToken: 'test'
    })
    expect(await accessRights.check({
      identity: 'https://identity.test.com', path: '/identity/passport/holland'
    })).to.deep.equal({read: false, write: false})
  })

  it('should be able to grant access to wildcard identities', async () => {
    expect(await accessRights.check({
      userID: env.testUserID, identity: 'https://identity.test.com', path: '/identity/name/display'
    })).to.deep.equal({
      read: false, write: false
    })
    await accessRights.grant({
      userID: env.testUserID, identity: 'https://*.test.com',
      pattern: '/identity/name/display',
      read: true, write: false
    })
    expect(await accessRights.check({
      userID: env.testUserID, identity: 'https://identity.test.com', path: '/identity/name/display'
    })).to.deep.equal({
      read: true, write: false
    })
  })
}

describe('Memory access rights', () => {
  let accessRights
  accessRights = new MemoryAccessRights()
  let dummyNow = moment({year: 2017, month: 7, day: 7, hour: 10})
  accessRights._getNow = () => dummyNow
  
  beforeEach(() => {
    accessRights.clear()
  })

  testAccessRights({accessRights, testUserID: 'test'})
})

describe('Sequelize access rights', () => {
  const env = {accessRights: null, testUserID: null}
  let sequelize, sequelizeModels

  before(async () => {
    const db = await initSequelize({
      devMode: true
    })
    sequelize = db.sequelize
    sequelizeModels = db.sequelizeModels
    await sequelize.sync()
    
    const testIdentity = await sequelizeModels.Identity.create({
      userName: 'test',
      seedPhraseHash: 'seedPhraseHash',
      dataBackend: 'mysql',
      verificationBackend: 'mysql+pgp',
      privateKey: 'keyPair.privateKey',
      publicKey: 'keyPair.publicKey',
    })
    env.testUserID = testIdentity.id
    
    env.accessRights = new SequelizeAccessRights(
      {ruleModel: sequelizeModels.AccessRule})
    let dummyNow = moment({year: 2017, month: 7, day: 7, hour: 10})
    env.accessRights._getNow = () => dummyNow
  })

  beforeEach(async () => {
    await sequelizeModels.AccessRule.destroy({truncate: true})
  })

  testAccessRights(env)
})
