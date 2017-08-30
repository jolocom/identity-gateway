'use strict';
module.exports = function(sequelize, DataTypes) {
  var LinkedIdentity = sequelize.define('linkedIdentity', {
    type: DataTypes.STRING,
    identifier: DataTypes.STRING
  });
  LinkedIdentity.associate = function(models) {
    LinkedIdentity.belongsTo(models.identity)
  }
  return LinkedIdentity;
};