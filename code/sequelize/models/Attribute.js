'use strict';
module.exports = function(sequelize, DataTypes) {
  var Attribute = sequelize.define('attribute', {
    type: DataTypes.STRING,
    dataType: DataTypes.STRING,
    key: DataTypes.STRING,
    value: DataTypes.TEXT
  });
  Attribute.associate = function(models) {
    Attribute.belongsTo(models.identity)
  }
  return Attribute
};
