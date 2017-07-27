import * as _ from 'lodash'
import * as Sequelize from 'sequelize'


export function defineSequelizeModels(sequelize) {
  const models : any = {
    Identity: {
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

  for(let key in models) {
    models[key] = sequelize.define(_.snakeCase(key), models[key])
  }

  models.Attribute.belongsTo(models.Identity)
  models.Verification.belongsTo(models.Attribute)

  return models
}
