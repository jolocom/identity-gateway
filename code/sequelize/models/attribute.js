'use strict';
module.exports = function(sequelize, DataTypes) {
  var Attribute = sequelize.define('Attribute', {
    type: Sequelize.STRING,
    dataType: Sequelize.STRING,
    key: Sequelize.STRING,
    value: Sequelize.TEXT
  }, {
    classMethods: {
      associate: function(models) {
        Attribute.belongsTo(models.Identity)
      }
    }
  });
  return Attribute
};
