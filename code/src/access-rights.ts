import * as _ from 'lodash'
import * as moment from 'moment'
import * as minimatch from 'minimatch'

export interface AccessRights {
  grant({userID, identity, pattern, read, write, expiryDate, oneTimeToken} :
        {userID : string, identity : string, pattern : string,
         read: boolean, write: false, expiryDate? : moment.Moment, oneTimeToken? : string
        })
  // revoke({userID, identity, oneTimeToken, pattern, read, write} :
  //        {userID : string, identity : string, pattern : string,
  //         read: boolean, write: false, expiryDate? : moment.Moment, oneTimeToken? : string
  //        })
  check({userID, identity, path} : {userID : string, identity : string, path : string})
       : Promise<{read : boolean, write : boolean}>

  list({userID} : {userID : string})
      : Promise<Array<{identity : string, pattern : string, read : boolean, write : boolean}>>
}

export class MemoryAccessRights implements AccessRights {
  public rules

  constructor() {
    this.clear()
  }

  clear() {
    this.rules = {}
  }

  async grant({userID, identity, pattern, read, write, expiryDate, oneTimeToken} :
              {userID : string, identity : string, pattern : string,
               read: boolean, write: false, expiryDate? : moment.Moment, oneTimeToken? : string
              })
  {
    this.rules[userID] = this.rules[userID] || []
    this.rules[userID].push({identity, pattern, read, write, expiryDate, oneTimeToken})
  }

  async check({userID, identity, path, oneTimeToken} :
              {userID : string, identity : string, path : string, oneTimeToken? : string}) :
    Promise<{read : boolean, write : boolean}>
  {
    identity = normalizedIdentity(identity)
    const identityRules = _(this.rules[userID])
      .map((rule, idx) => ({...rule, idx}))
      .filter(rule => rule.identity === identity)
      .filter(rule => !rule.token || rule.token === oneTimeToken)
      .filter(rule => !rule.expiryDate || rule.expiryDate.isAfter(this._getNow()))
      .filter(rule => minimatch(path, rule.pattern))
      .valueOf()

    if (oneTimeToken) {
      this.rules = _.filter(this.rules, rule => rule.oneTimeToken !== oneTimeToken)
    }

    return {
      read: _.some(identityRules, rule => rule.read),
      write: _.some(identityRules, rule => rule.write)
    }
  }

  async list({userID} :
             {userID : string}) :
   Promise<Array<{identity : string, pattern : string, read : boolean, write : boolean}>>
   {
     this.rules[userID] = this.rules[userID] || []
     return this.rules[userID]
   }

  _getNow() {
    return moment()
  }
}

export class SequelizeAccessRights implements AccessRights {
  private _ruleModel

  constructor({ruleModel}) {
    this._ruleModel = ruleModel
  }

  async grant({userID, identity, pattern, read, write, expiryDate, oneTimeToken} :
              {userID : string, identity : string, pattern : string,
               read: boolean, write: false, expiryDate? : moment.Moment, oneTimeToken? : string
              })
  {
    await this._ruleModel.create({
      identityId: userID, requester: identity, pattern, read, write, expiryDate, oneTimeToken
    })
  }

  async check({userID, identity, path, oneTimeToken} :
              {userID : string, identity : string, path : string, oneTimeToken? : string}) :
    Promise<{read : boolean, write : boolean}>
  {
    let identityRules = await this._ruleModel.findAll({where: {
      identityId: userID,
      requester: identity
    }})
    identityRules = _(identityRules)
      .map((rule, idx) => ({...rule, idx}))
      .filter(rule => !rule.token || rule.token === oneTimeToken)
      .filter(rule => !rule.expiryDate || rule.expiryDate.isAfter(this._getNow()))
      .filter(rule => minimatch(path, rule.pattern))
      .valueOf()

    if (oneTimeToken) {
      await this._ruleModel.delete({where: {oneTimeToken}})
    }

    return {
      read: _.some(identityRules, rule => rule.read),
      write: _.some(identityRules, rule => rule.write)
    }
  }

  async list({userID} :
             {userID : string}) :
   Promise<Array<{identity : string, pattern : string, read : boolean, write : boolean}>>
   {
     let identityRules = await this._ruleModel.findAll({where: {
       identityId: userID
     }})

     return identityRules
   }

  _getNow() {
    return moment()
  }
}

function normalizedIdentity(identity : string) {
  return identity.replace(/\/+$/g, '')
}

function normalizedPath(identity : string) {
  return identity.replace(/\/+$/g, '')
}
