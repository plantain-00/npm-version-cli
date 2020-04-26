import * as inquirer from 'inquirer'
import * as semver from 'semver'
import * as path from 'path'
import * as fs from 'fs'
import * as util from 'util'
import * as xmlJs from 'xml-js'

const writeFileAsync = util.promisify(fs.writeFile)
const readFileAsync = util.promisify(fs.readFile)

export function statAsync(path: string) {
  return new Promise<fs.Stats | undefined>((resolve) => {
    fs.stat(path, (err, stats) => {
      if (err) {
        resolve(undefined)
      } else {
        resolve(stats)
      }
    })
  })
}

export async function askVersion() {
  const identifierAnswer = await inquirer.prompt<{ identifier: string }>({
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
  await writeFileAsync(packageJsonPath, JSON.stringify(packageJsonData, null, 2) + '\n')

  const stats = await statAsync(csxsPath)
  if (stats && stats.isFile() && !semver.prerelease(newVersionAnswer.newVersion)) {
    const xml = await readFileAsync(csxsPath, 'utf8')
    const obj = xmlJs.xml2js(xml)
    if (obj.elements?.[0]?.attributes?.ExtensionBundleVersion) {
      obj.elements[0].attributes.ExtensionBundleVersion = newVersionAnswer.newVersion
    }
    await writeFileAsync(csxsPath, xmlJs.js2xml(obj, { spaces: 2 }) + '\n')
  }

  return newVersionAnswer.newVersion
}

export const csxsPath = path.resolve(process.cwd(), 'CSXS', 'manifest.xml')
