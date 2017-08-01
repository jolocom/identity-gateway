import * as moment from 'moment'
import { expect } from 'chai'
import { MemoryAccessRights, SequelizeAccessRights } from './access-rights'
import * as Sequelize from 'sequelize'
import { defineSequelizeModels } from './sequelize/models'

function testAccessRights({accessRights}) {
  it('should be able to modify and test access rights', async () => {
    await accessRights.grant({
      userID: 'test', identity: 'https://identity.test.com', pattern: '/identity/passport/*',
      read: true, write: false
    })
    await accessRights.grant({
      userID: 'test', identity: 'https://identity.test.com', pattern: '/identity/passport/holland',
      read: true, write: true
    })
    expect(await accessRights.check({
      userID: 'test', identity: 'https://identity.test.com', path: '/identity/passport/greece'
    })).to.deep.equal({
      read: true, write: false
    })
  })

  it('should be able to grant temporary access', async () => {
    await accessRights.grant({
      identity: 'https://identity.test.com', pattern: '/identity/passport/*',
      read: true, write: false, expiryDate: moment(accessRights._getNow()).add(1, 'hour'), oneTimeToken: 'test'
    })
    expect(await accessRights.check({
      identity: 'https://identity.test.com', path: '/identity/passport/holland', oneTimeToken: 'test'
    })).to.deep.equal({
      read: true, write: false
    })
    expect(await accessRights.check({
      identity: 'https://identity.test.com', path: '/identity/passport/holland'
    })).to.deep.equal({read: false, write: false})

    await accessRights.grant({
      identity: 'https://identity.test.com', pattern: '/identity/passport/holland/verifications/jolocom',
      read: true, write: false, expiryDate: accessRights._getNow().subtract(1, 'hour'), oneTimeToken: 'test'
    })
    expect(await accessRights.check({
      identity: 'https://identity.test.com', path: '/identity/passport/holland'
    })).to.deep.equal({read: false, write: false})
  })
}

describe('Memory access rights', () => {
  const accessRights = new MemoryAccessRights()
  let dummyNow = moment({year: 2017, month: 7, day: 7, hour: 10})
  accessRights._getNow = () => dummyNow

  beforeEach(() => {
    accessRights.clear()
  })

  testAccessRights({accessRights})
})

describe('Sequelize access rights', async () => {
  const sequelize = new Sequelize('sqlite://')
  await sequelize.authenticate()

  const sequelizeModels = defineSequelizeModels(sequelize)
  await sequelize.sync()
  const accessRights = new SequelizeAccessRights(
    {ruleModel: sequelizeModels.Rules})
  let dummyNow = moment({year: 2017, month: 7, day: 7, hour: 10})
  accessRights._getNow = () => dummyNow

  beforeEach(async () => {
    await sequelizeModels.Rules.Delete()
  })

  testAccessRights({accessRights})
})
