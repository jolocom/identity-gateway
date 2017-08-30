'use strict';
module.exports = function(sequelize, DataTypes) {
  var Verification = sequelize.define('Verification', {
    identity: DataTypes.STRING,
    signature: DataTypes.TEXT,
    linkedIdentities: DataTypes.TEXT
  }, {
    classMethods: {
      associate: function(models) {
        Verification.belongsTo(models.Attribute)
      }
    }
  });
  return Verification;
};