'use strict';
module.exports = function(sequelize, DataTypes) {
  var Identity = sequelize.define('identity', {
    userName: DataTypes.STRING,
    seedPhraseHash: DataTypes.STRING,
    privateKey: DataTypes.TEXT,
    publicKey: DataTypes.TEXT
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return Identity;
};