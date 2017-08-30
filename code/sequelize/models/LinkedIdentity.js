'use strict';
module.exports = function(sequelize, DataTypes) {
  var LinkedIdentity = sequelize.define('LinkedIdentity', {
    type: DataTypes.STRING,
    identifier: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        LinkedIdentity.belongsTo(models.Identity)
      }
    }
  });
  return LinkedIdentity;
};