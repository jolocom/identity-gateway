'use strict';
module.exports = function(sequelize, DataTypes) {
  var registrationInvite = sequelize.define('registrationInvite', {
    code: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return registrationInvite;
};