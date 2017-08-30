'use strict';
module.exports = function(sequelize, DataTypes) {
  var Verification = sequelize.define('verification', {
    identity: DataTypes.STRING,
    signature: DataTypes.TEXT,
    linkedIdentities: DataTypes.TEXT
  });
  Verification.associate = function(models) {
    Verification.belongsTo(models.attribute)
  }
  return Verification;
};