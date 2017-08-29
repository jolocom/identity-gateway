'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.createTable('AccessRules', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      identityId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Identities',
          key: 'id'
        },
        onUpdate: 'cascade',
        onDelete: 'cascade'
      },
      requester: {
        type: Sequelize.STRING
      },
      pattern: {
        type: Sequelize.STRING
      },
      read: {
        type: Sequelize.BOOLEAN
      },
      write: {
        type: Sequelize.BOOLEAN
      },
      expiryDate: {
        type: Sequelize.DATE
      },
      oneTimeToken: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: function(queryInterface, Sequelize) {
    return queryInterface.dropTable('AccessRules');
  }
};