'use strict';

const debug = require('debug')('mozilla-contributions:reps');
const fs = require('fs').promises;
const StorageHandler = require('./storage-handler');

module.exports = {
  processActivities,
};

async function processActivities() {
  const {
    REPS_ACTIVITY_PATH: repsActivitiesPath,
    REPS_USERNAME: repsUsername,
  } = process.env;

  if (!repsActivitiesPath || !repsUsername) {
    debug('No path or user name for activities passed');
    return Promise.resolve();
  }

  debug(`Getting activities from ${repsActivitiesPath}`);

  let activities = [];
  try {
    activities = JSON.parse(await fs.readFile(repsActivitiesPath, 'utf-8'));
  } catch (error) {
    debug('Could not read file content as JSON, aborting..', error);
    return activities;
  }

  debug(`Fetched ${activities.length} activities to analyze`);
  const myActivites = activities.filter((activity) => activity.user.display_name === repsUsername);
  debug(`Found ${myActivites.length} activity reports belonging to you`);
  const formatted = myActivites.map(formatActivity);
  await save(formatted);
  debug('Finished saving activities');
  return formatted;
}

async function save(activities) {
  const instance = StorageHandler.getInstance();
  await instance.deleteBySource('reps');
  return instance.saveContributions(activities);
}

function formatActivity(activity) {
  const createdAt = new Date(activity.report_date);
  let description = activity.activity_description;

  if (activity.event && activity.activity_description) {
    description = `${activity.event.name}: ${activity.activity_description}`;
  } else if (activity.event) {
    description = activity.event.name;
  }

  return {
    createdAt,
    description,
    type: activity.activity,
    link: activity.link,
    source: 'reps',
  };
}
