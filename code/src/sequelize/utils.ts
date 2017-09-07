import * as _ from 'lodash'
global['SEQUELIZE_MODEL_FACTORY'] = true
const createSequelizeModels = require('../../sequelize/models')

export async function createOrUpdate(model, where, values) {
  const [result, created] = await model.findOrCreate({where, defaults: values})
  if (!created) {
    await model.update(values, {where})
  }
  return {created}
}

export async function initSequelize({devMode}) {
  let db
  if (devMode) {
    db = createSequelizeModels({
      databaseUrl: process.env.DATABASE || 'sqlite://'
    })
  } else {
    db = createSequelizeModels()
  }
  const sequelize = db.sequelize
  const sequelizeModels = _(db).map((model, key) => {
    if (['sequelize', 'Sequelize'].indexOf(key) >= 0) {
      return
    }

    return [_.upperFirst(key), model]
  }).filter(pair => !!pair).fromPairs().valueOf()

  return {sequelize, sequelizeModels}
}
