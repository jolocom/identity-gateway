'use strict';
module.exports = function(sequelize, DataTypes) {
  var Identity = sequelize.define('Identity', {
    userName: DataTypes.STRING,
    seedPhraseHash: DataTypes.STRING,
    privateKey: DataTypes.STRING,
    publicKey: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return Identity;
};