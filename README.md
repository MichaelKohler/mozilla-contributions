# Mozilla Contributions

This project captures contributions to Mozilla, depending on a config.

The following sources are supported:

* Mozilla Reps Activities
* GitHub Commits
* GitHub Issues created

## Restrictions

* Maximum of 1000 commits search results per month

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
| GITHUB_USERNAME | The GitHub username to search for | Yes | - |
| GITHUB_TOKEN | GitHub personal access token | Yes | - |
| GITHUB_FILTER | Filter (Regex) to search for in organization/repo name | No | Uses all returned values |
| GITHUB_STOP_DATE | Date in `YYYY-MM-DD format` which indicates the earliest possible contribution | No | 2010-01-01 |
| REPS_ACTIVITY_PATH | Absolute path to the Reps Activities JSON file, see [reps-archive](https://github.com/mozilla/reps-archive) to see how to generate it (as long as the Portal is still up) | No | - |
| REPS_USERNAME | Reps username to search for | No | - |

### Example for GITHUB_FILTER

For (contributions.michaelkohler.info)[https://contributions.michaelkohler.info] I'm using the following value:

```
GITHUB_FILTER="mozilla|common-voice|reps|remo|sc-scripts|webmaker|firefox|activate|surprisera|fxos|foxfooding|arewetenyet|asknot|community_dashboard_participation|appday"
```

## Forking this project

When forking this project, make sure to adjust the following:

* GitHub workflows to whatever you need it to be to deploy
* k8s/deployment.yml file to use the right docker image and config
