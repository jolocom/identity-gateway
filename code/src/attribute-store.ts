import * as _ from 'lodash'

export interface AttributeStore {
  storeStringAttribute({userId, type, id, value} :
                       {userId : string, type : string, id : string, value : string})
  storeJsonAttribute({userId, type, id, value} :
                     {userId : string, type : string, id : string, value : string})
  retrieveAttribute({userId, type, id} : {userId : string, type : string, id : string})
    : Promise<{value : any, dataType : string}>
  deleteAttribute({userId, type, id} : {userId : string, type : string, id : string})
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

  async _storeAttribute({userId, type, id, dataType, value} :
                        {userId : string, type : string, id : string,
                         dataType : string, value : string}) {
    if (!this.attributes[userId]) {
      this.attributes[userId] = {}
    }
    const userAttributes = this.attributes[userId]

    const attrKey = `${type}_${id}`
    userAttributes[attrKey] = {value, dataType}
  }

  async storeStringAttribute({userId, type, id, value} :
                             {userId : string, type : string, id : string, value : string}) {
    this._storeAttribute({userId, type, id, dataType: 'string', value})
  }

  async storeJsonAttribute({userId, type, id, value} :
                             {userId : string, type : string, id : string, value : any}) {
      this._storeAttribute({userId, type, id, dataType: 'json', value})
  }

  async retrieveAttribute({userId, type, id} : {userId : string, type : string, id : string}) {
    const userAttributes = this.attributes[userId] || {}
    const attrKey = `${type}_${id}`
    const attribute = userAttributes[attrKey]
    if (!attribute) {
      return undefined
    }
    return {value: attribute.value, dataType: attribute.dataType}
  }

  async deleteAttribute({userId, type, id} : {userId : string, type : string, id : string}) {
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
      identityId: userId, type, key: id, dataType: 'string'
    }, defaults: {value}})
    if (!created) {
      await obj.update({value})
    }
  }

  async storeJsonAttribute({userId, type, id, value} :
                             {userId : string, type : string, id : string, value : string})
  {
    const [obj, created] = await this._attributeModel.findOrCreate({where: {
      identityId: userId, type, key: id, dataType: 'json'
    }, defaults: {value: JSON.stringify(value)}})
    if (!created) {
      await obj.update({value: JSON.stringify(value)})
    }
  }

  async retrieveAttribute({userId, type, id} : {userId : string, type : string, id : string}) {
    const attribute = await this._attributeModel.findOne({where: {
      identityId: userId, type, key: id,
    }})
    if (!attribute) {
      return undefined
    }
    return {
      value: attribute.dataType === 'string' ? attribute.value : JSON.parse(attribute.value),
      dataType: attribute.dataType
    }
  }

  async deleteAttribute({userId, type, id} : {userId : string, type : string, id : string}) {
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
