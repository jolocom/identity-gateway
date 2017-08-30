'use strict';
module.exports = function(sequelize, DataTypes) {
  var Attribute = sequelize.define('Attribute', {
    type: DataTypes.STRING,
    dataType: DataTypes.STRING,
    key: DataTypes.STRING,
    value: DataTypes.TEXT
  }, {
    classMethods: {
      associate: function(models) {
        Attribute.belongsTo(models.Identity)
      }
    }
  });
  return Attribute
};
