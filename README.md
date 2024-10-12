# .ics trimmer

A simple script to trim down big .ics calendar files by date range so they can be imported faster.

## Prerequisites
- [Node.js](https://nodejs.org/)
- [Yarn Classic](https://classic.yarnpkg.com/en/docs/install)

## Install

```shell
yarn install
```

## Run

Put .ics files in the `/input` directory and adjust the `/src/config.ts` file if needed. Then run:

```shell
yarn start
```

The trimmed .ics files will be in the `/output` directory.
