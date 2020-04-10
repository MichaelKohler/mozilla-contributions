# Mozilla Contributions

This project captures contributions to Mozilla, depending on a config.

The following sources are supported:

* Mozilla Reps Activities

## Setup

First install [Node](http://nodejs.org/) and [docker](https://www.docker.com/).

```
npm ci
```

Now you can run the script:

```
npm run start:db
# Wait a while to make sure MariaDB is up
npm start
```

You can add `FETCH="true"` if you want to update the data.

## Configuration

All configuration is supplied through environment variables:

| Environment Variable | Description | Required | Default |
|---|---|---|---|
| CONNECT | MySQL connection string | Yes | - |
| REPS_ACTIVITY_PATH | Absolute path to the Reps Activities JSON file, see [reps-archive](https://github.com/mozilla/reps-archive) to see how to generate it (as long as the Portal is still up) | No | - |
| REPS_USERNAME | Reps username to search for | No | - |

## Forking this project

When forking this project, make sure to adjust the following:

* GitHub workflows to whatever you need it to be to deploy
* k8s/deployment.yml file to use the right docker image and config
