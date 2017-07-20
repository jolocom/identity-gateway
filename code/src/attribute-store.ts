export interface AttributeStore {
  storeStringAttribute({userId, type, id, value} :
                       {userId : string, type : string, id : string, value : string})
  retrieveStringAttribute({userId, type, id} : {userId : string, type : string, id : string})
  deleteStringAttribute({userId, type, id} : {userId : string, type : string, id : string})
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
    return userAttributes[attrKey]
  }

  async deleteStringAttribute({userId, type, id} : {userId : string, type : string, id : string}) {
    const userAttributes = this.attributes[userId] || {}
    const attrKey = `${type}_${id}`
    delete userAttributes[attrKey]
  }
}
