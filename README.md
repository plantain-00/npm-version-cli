# npm-version-cli

better npm version with identifier

[![Dependency Status](https://david-dm.org/plantain-00/npm-version-cli.svg)](https://david-dm.org/plantain-00/npm-version-cli)
[![devDependency Status](https://david-dm.org/plantain-00/npm-version-cli/dev-status.svg)](https://david-dm.org/plantain-00/npm-version-cli#info=devDependencies)
[![Build Status: Linux](https://travis-ci.org/plantain-00/npm-version-cli.svg?branch=master)](https://travis-ci.org/plantain-00/npm-version-cli)
[![Build Status: Windows](https://ci.appveyor.com/api/projects/status/github/plantain-00/npm-version-cli?branch=master&svg=true)](https://ci.appveyor.com/project/plantain-00/npm-version-cli/branch/master)
![Github CI](https://github.com/plantain-00/npm-version-cli/workflows/Github%20CI/badge.svg)
[![npm version](https://badge.fury.io/js/npm-version-cli.svg)](https://badge.fury.io/js/npm-version-cli)
[![Downloads](https://img.shields.io/npm/dm/npm-version-cli.svg)](https://www.npmjs.com/package/npm-version-cli)
[![type-coverage](https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Fplantain-00%2Fnpm-version-cli%2Fmaster%2Fpackage.json)](https://github.com/plantain-00/npm-version-cli)

## install

`yarn global add npm-version-cli`

## features

+ npm version: package.json
+ adobe plugin version: CSXS/manifest.xml

## usage

run `npm-version-cli`

## options

key | description
--- | ---
-h,--help | Print this message.
-v,--version | Print the version
--changelog | Generate CHANGELOG.md

## API

```ts
import { askVersion } from 'npm-version-cli'

await askVersion()

```
