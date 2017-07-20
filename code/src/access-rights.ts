import * as _ from 'lodash'
import * as moment from 'moment'
import * as minimatch from 'minimatch'

export interface AccessRights {
  grant({identity, pattern, read, write, expiryDate, oneTimeToken} : 
        {identity : string, pattern : string,
         read: boolean, write: false, expiryDate? : moment.Moment, oneTimeToken? : string
        })
  check({identity, path} : {identity : string, path : string})
       : Promise<{read : boolean, write : boolean}>
}

export class MemoryAccessRights implements AccessRights {
  public rules

  constructor() {
    this.clear()
  }

  clear() {
    this.rules = []
  }

  async grant({identity, pattern, read, write, expiryDate, oneTimeToken} : 
        {identity : string, pattern : string,
         read: boolean, write: false, expiryDate? : moment.Moment, oneTimeToken? : string
        })
  {
    this.rules.push({identity, pattern, read, write, expiryDate, oneTimeToken})
  }

  async check({identity, path, oneTimeToken} : {identity : string, path : string, oneTimeToken? : string}) :
    Promise<{read : boolean, write : boolean}>
  {
    identity = normalizedIdentity(identity)
    const identityRules = _(this.rules)
      .map((rule, idx) => ({...rule, idx}))
      .filter(rule => rule.identity === identity)
      .filter(rule => !rule.token || rule.token === oneTimeToken)
      .filter(rule => !rule.expiryDate || rule.expiryDate.isAfter(this._getNow()))
      .filter(rule => minimatch(path, rule.pattern))
      .valueOf()

    this.rules = _.filter(this.rules, rule => !rule.oneTimeToken)

    return {
      read: _.some(identityRules, rule => rule.read),
      write: _.some(identityRules, rule => rule.write)
    }
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
