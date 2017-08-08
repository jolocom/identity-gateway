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

export class SequelizeAttributeStore implements AttributeStore {
  private _attributeModel

  constructor({attributeModel}) {
    this._attributeModel = attributeModel
  }

  async storeStringAttribute({userId, type, id, value} :
                             {userId : string, type : string, id : string, value : string})
  {
    const [obj, created] = await this._attributeModel.findOrCreate({where: {
      identityId: userId, type, key: id
    }, defaults: {value}})
    if (!created) {
      await obj.update({value})
    }
  }

  async retrieveStringAttribute({userId, type, id} : {userId : string, type : string, id : string}) {
    const attribute = await this._attributeModel.findOne({where: {
      identityId: userId, type, key: id,
    }})
    return {value: attribute.value}
  }

  async deleteStringAttribute({userId, type, id} : {userId : string, type : string, id : string}) {
    await this._attributeModel.destroy({where: {
      identityId: userId,
      type,
      key: id,
    }})
  }

  async listAttributeTypes({userId}) : Promise<string[]> {
    const attributes = await this._attributeModel.find({where: {identityId: userId}})
    return _(attributes)
      .map(attribute => attribute.type)
      .sort()
      .sortedUniq()
      .valueOf()
  }

  async listAttributes({userId, type}) : Promise<string[]> {
    const attributes = await this._attributeModel.findAll({where: {
      identityId: userId, type
    }})
    return _(attributes)
      .map(attribute => attribute.key)
      .sort()
      .sortedUniq()
      .valueOf()
  }
}
