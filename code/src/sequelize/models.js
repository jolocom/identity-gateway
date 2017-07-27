import * as _ from 'lodash'
import * as Sequelize from 'sequelize'


export function defineModels(sequelize) {
  const models = {
    Idenitity: {
      userName: Sequelize.STRING,
      seedPhraseHash: Sequelize.TEXT,
      dataBackend: Sequelize.STRING,
      verificationBackend: Sequelize.STRING,
      privateKey: Sequelize.TEXT,
      publicKey: Sequelize.TEXT,
    },
    Attribute: {
      type: Sequelize.STRING,
      key: Sequelize.STRING,
      value: Sequelize.TEXT,
    },
    Verification: {
      identity: Sequelize.STRING,
      signature: Sequelize.TEXT,
    }
  }

  for(let key of models) {
    models[key] = sequelize.define(_.snakeCase(key), models[key])
  }

  models.Attribute.belongsTo(models.Idenitity)
  models.Verification.belongsTo(models.Attribute)

  return models
}
