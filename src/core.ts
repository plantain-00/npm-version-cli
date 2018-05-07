import * as inquirer from 'inquirer'
import * as semver from 'semver'
import * as path from 'path'
import * as fs from 'fs'

function writeFile(filename: string, data: string) {
  return new Promise<void>((resolve, reject) => {
    fs.writeFile(filename, data, error => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export async function askVersion() {
  let identifierAnswer = await inquirer.prompt<{ identifier: string }>({
    type: 'list',
    name: 'identifier',
    message: 'Select a new identifier:',
    choices: [
      '',
      'alpha',
      'beta',
      'rc'
    ]
  })
  const identifier = identifierAnswer.identifier

  const packageJsonPath = path.resolve(process.cwd(), 'package.json')
  const packageJsonData: { version: string } = require(packageJsonPath)

  const patchVersion = semver.inc(packageJsonData.version, 'patch')!
  const minorVersion = semver.inc(packageJsonData.version, 'minor')!
  const majorVersion = semver.inc(packageJsonData.version, 'major')!
  const prepatchVersion = semver.inc(packageJsonData.version, 'prepatch', true, identifier)!
  const preminorVersion = semver.inc(packageJsonData.version, 'preminor', true, identifier)!
  const premajorVersion = semver.inc(packageJsonData.version, 'premajor', true, identifier)!
  const prereleaseVersion = semver.inc(packageJsonData.version, 'prerelease', true, identifier)!
  const customVersionChoice = 'Custom'
  let newVersionAnswer = await inquirer.prompt<{ newVersion: string }>({
    type: 'list',
    name: 'newVersion',
    message: 'Select a new version:',
    choices: [
      {
        name: `Patch ${packageJsonData.version} -> ${patchVersion}`,
        value: patchVersion
      },
      {
        name: `Minor ${packageJsonData.version} -> ${minorVersion}`,
        value: minorVersion
      },
      {
        name: `Major ${packageJsonData.version} -> ${majorVersion}`,
        value: majorVersion
      },
      {
        name: `Pre Patch ${packageJsonData.version} -> ${prepatchVersion}`,
        value: prepatchVersion
      },
      {
        name: `Pre Minor ${packageJsonData.version} -> ${preminorVersion}`,
        value: preminorVersion
      },
      {
        name: `Pre Major ${packageJsonData.version} -> ${premajorVersion}`,
        value: premajorVersion
      },
      {
        name: `Pre Release ${packageJsonData.version} -> ${prereleaseVersion}`,
        value: prereleaseVersion
      },
      customVersionChoice
    ]
  })
  if (newVersionAnswer.newVersion === customVersionChoice) {
    newVersionAnswer = await inquirer.prompt<{ newVersion: string }>({
      type: 'input',
      name: 'newVersion',
      message: 'Enter a custom version:',
      filter: (input: string) => semver.valid(input)!,
      validate: input => input !== null || 'Must be a valid semver version'
    })
  }
  packageJsonData.version = newVersionAnswer.newVersion
  await writeFile(packageJsonPath, JSON.stringify(packageJsonData, null, 2) + '\n')
  return newVersionAnswer.newVersion
}
