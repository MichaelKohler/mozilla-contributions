'use strict';

const debug = require('debug')('mozilla-contributions:storageHandler');
const mysql = require('mysql');

const createContributionsTable = `
CREATE TABLE IF NOT EXISTS contributions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  createdAt DATE,
  type VARCHAR(255) NOT NULL,
  link VARCHAR(255) NOT NULL,
  description TEXT,
  source VARCHAR(255) NOT NULL
)
`;

let instance;

module.exports = {
  getInstance,
};

function getInstance() {
  if (instance) {
    return instance;
  }

  instance = new StorageHandler();
  return instance;
}

class StorageHandler {
  connect() {
    if (this.mysqlConnection) {
      return Promise.resolve();
    }

    debug('Initializing mysql client..');
    const connectString = process.env.CONNECT;
    if (!connectString) {
      throw new Error('NO_CONNECT_ENV_VARIABLE');
    }

    this.mysqlConnection = mysql.createConnection(connectString);
    this.mysqlConnection.on('error', (error) => {
      debug('MYSQL_ERROR', error);
      if (error.fatal) {
        delete this.mysqlConnection;
        this.connect();
      }
    });
    return new Promise((resolve, reject) => {
      this.mysqlConnection.connect(async (error) => {
        if (error) {
          return reject(error);
        }

        debug('Connected to database');
        await this.createTables();
        return resolve();
      });
    });
  }

  createTables() {
    debug('Creating tables..');
    return new Promise((resolve, reject) => {
      this.mysqlConnection.query(createContributionsTable, (error) => {
        if (error) {
          return reject(error);
        }

        debug('Created contributions table');
        return resolve();
      });
    });
  }

  saveContributions(newContributions) {
    debug('Start saving contributions if not yet existing..');
    // eslint-disable-next-line no-async-promise-executor
    const promises = newContributions.map((contribution) => new Promise(async (resolve, reject) => {
      const fixedContribution = {
        ...contribution,
        description: contribution.description.replace(/[^\x00-\x7F]/g, ''),
      };

      const existingContributions = await this.checkIfExisting(fixedContribution);
      if (existingContributions && existingContributions.length > 0) {
        return resolve();
      }

      this.mysqlConnection.query('INSERT INTO contributions SET ?', fixedContribution, (error) => {
        if (error) {
          return reject(error);
        }

        return resolve();
      });
    }));

    return Promise.all(promises);
  }

  checkIfExisting(contribution) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM contributions
        WHERE
          createdAt = ? AND
          description = ? AND
          link = ? AND
          type = ? AND
          source = ?
      `;
      const { createdAt, description, link, type, source } = contribution;
      const formattedCreatedAt = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}-${createdAt.getDate()}`;
      const fields = [formattedCreatedAt, description, link, type, source];
      this.mysqlConnection.query(query, fields, (error, results) => {
        if (error) {
          return reject(error);
        }

        return resolve(results);
      });
    });
  }

  getLatestBySource(source) {
    return new Promise((resolve, reject) => {
      this.mysqlConnection.query('SELECT * FROM contributions WHERE source = ? LIMIT 1', source, (error, results) => {
        if (error) {
          return reject(error);
        }

        return resolve(results);
      });
    });
  }

  getContributions() {
    debug('Start getting contributions..');
    return new Promise((resolve, reject) => {
      this.mysqlConnection.query('SELECT * FROM contributions ORDER BY createdAt DESC', (error, results) => {
        if (error) {
          return reject(error);
        }

        return resolve(results);
      });
    });
  }

  deleteBySource(source) {
    debug(`Deleting all entries with source: ${source}`);
    return new Promise((resolve, reject) => {
      this.mysqlConnection.query(`DELETE FROM contributions WHERE source = ?`, source, (error, results) => {
        if (error) {
          return reject(error);
        }

        return resolve(results);
      });
    });
  }
}
