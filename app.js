'use strict';

const express = require('express');
const path = require('path');
const logger = require('morgan');
const bodyParser = require('body-parser');

const StorageHandler = require('./lib/storage-handler');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', async (req, res) => {
  const storageInstance = StorageHandler.getInstance();
  try {
    const contributions = await storageInstance.getContributions();
    res.render('index', { contributions });
  } catch (error) {
    res.send('Could not get contributions!');
  }
});

app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use((error, req, res) => {
  res.status(error.status || 500); // eslint-disable-line no-magic-numbers
  res.send('error');
});

module.exports = app;
