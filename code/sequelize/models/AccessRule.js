'use strict';
module.exports = function(sequelize, DataTypes) {
  var AccessRule = sequelize.define('AccessRule', {
    requester: DataTypes.STRING,
    pattern: DataTypes.STRING,
    read: DataTypes.BOOLEAN,
    write: DataTypes.BOOLEAN,
    expiryDate: DataTypes.DATE,
    oneTimeToken: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        AccessRule.belongsTo(models.Identity)
      }
    }
  });
  return AccessRule;
};