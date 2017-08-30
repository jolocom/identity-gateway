'use strict';
module.exports = function(sequelize, DataTypes) {
  var AccessRule = sequelize.define('accessRule', {
    requester: DataTypes.STRING,
    pattern: DataTypes.STRING,
    read: DataTypes.BOOLEAN,
    write: DataTypes.BOOLEAN,
    expiryDate: DataTypes.DATE,
    oneTimeToken: DataTypes.STRING
  });
  AccessRule.associate = function(models) {
    AccessRule.belongsTo(models.identity)
  }
  return AccessRule;
};