import * as _ from 'lodash'

export interface AttributeStore {
  storeStringAttribute({userId, type, id, value} :
                       {userId : string, type : string, id : string, value : string})
  retrieveStringAttribute({userId, type, id} : {userId : string, type : string, id : string})
    : Promise<{value : string}>
  deleteStringAttribute({userId, type, id} : {userId : string, type : string, id : string})
  listAttributeTypes({userId}) : Promise<string[]>
  listAttributes({userId, type}) : Promise<string[]>
}

export class MemoryAttributeStore implements AttributeStore {
  private attributes

  constructor() {
    this.clear()
  }

  clear() {
    this.attributes = {}
  }

  async storeStringAttribute({userId, type, id, value} :
                             {userId : string, type : string, id : string, value : string}) {
    if (!this.attributes[userId]) {
      this.attributes[userId] = {}
    }
    const userAttributes = this.attributes[userId]

    const attrKey = `${type}_${id}`
    userAttributes[attrKey] = value
  }

  async retrieveStringAttribute({userId, type, id} : {userId : string, type : string, id : string}) {
    const userAttributes = this.attributes[userId] || {}
    const attrKey = `${type}_${id}`
    return {value: userAttributes[attrKey]}
  }

  async deleteStringAttribute({userId, type, id} : {userId : string, type : string, id : string}) {
    const userAttributes = this.attributes[userId] || {}
    const attrKey = `${type}_${id}`
    delete userAttributes[attrKey]
  }

  async listAttributeTypes({userId}) : Promise<string[]> {
    return _(this.attributes[userId] || {})
      .keys()
      .map(key => key.split('_')[0])
      .sort()
      .sortedUniq()
      .valueOf()
  }

  async listAttributes({userId, type}) : Promise<string[]> {
    return _(this.attributes[userId] || {})
      .keys()
      .filter(key => key.split('_')[0] === type)
      .map(key => key.split('_')[1])
      .sort()
      .sortedUniq()
      .valueOf()
  }
}
