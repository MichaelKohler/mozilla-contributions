# Mozilla Contributions

This project captures contributions to Mozilla, depending on a config.

The following sources are supported:

* Mozilla Reps Activities

## Setup

First install [Node](http://nodejs.org/) and clone this repository.

```
npm ci
```

Now you can run the script:

```
npm start
```

You can add `FETCH="true"` if you want to update the data.

## Configuration

All configuration is supplied through environment variables:

| Environment Variable | Description | Required | Default |
|---|---|---|---|
| REPS_ACTIVITY_PATH | Path to the Reps Activities JSON file, see [reps-archive](https://github.com/mozilla/reps-archive) to see how to generate it (as long as the Portal is still up) | No | - |
| REPS_USERNAME | Reps username to search for | No | - |
