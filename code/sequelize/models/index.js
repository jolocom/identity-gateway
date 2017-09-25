'use strict';

var fs        = require('fs');
var path      = require('path');
var Sequelize = require('sequelize');
var basename  = path.basename(module.filename);
var env       = process.env.NODE_ENV || 'production';
var db        = {};

function create(config) {
  if (!config) {
    config = require(__dirname + '/../config.json')[env];
  }
  if (config.useEnvVariable) {
    var sequelize = new Sequelize(process.env[config.useEnvVariable], {
      logging: process.env.LOG_SQL === 'true'
    });
  } else {
    var sequelize = new Sequelize(Object.assign({}, {logging: process.env.LOG_SQL === 'true'}, config));
  }

  fs
    .readdirSync(__dirname)
    .filter(function(file) {
      return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
    })
    .forEach(function(file) {
      var model = sequelize['import'](path.join(__dirname, file));
      db[model.name] = model;
    });

  Object.keys(db).forEach(function(modelName) {
    if (db[modelName].associate) {
      db[modelName].associate.bind(db[modelName])(db);
    }
  });

  db.sequelize = sequelize;
  db.Sequelize = Sequelize;

  return db
}

if (global.SEQUELIZE_MODEL_FACTORY) {
  module.exports = create
} else {
  module.exports = create(null)
}
