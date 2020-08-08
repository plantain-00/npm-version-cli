import * as inquirer from 'inquirer'
import * as semver from 'semver'
import * as path from 'path'
import * as fs from 'fs'
import * as util from 'util'
import * as xmlJs from 'xml-js'
import { iterateCommits } from 'git-commits-to-changelog'
import glob from 'glob'
import * as childProcess from 'child_process'

export const writeFileAsync = util.promisify(fs.writeFile)
const readFileAsync = util.promisify(fs.readFile)
const globAsync = util.promisify(glob)

export function statAsync(path: string): Promise<fs.Stats | undefined> {
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

function execAsync(script: string) {
  return new Promise<string>((resolve, reject) => {
    childProcess.exec(script, (err, stdout) => {
      if (err) {
        reject(err)
      } else {
        resolve(stdout)
      }
    })
  })
}

export async function askVersion(): Promise<{ version: string, effectedWorkspaces?: Workspace[][] }> {
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
  const packageJsonData: PackageJson = require(packageJsonPath)

  let version: string
  let lastVersionCommit: { version: string, hash: string } | undefined
  if (!packageJsonData.version) {
    lastVersionCommit = getLastestVersionCommit()
    if (!lastVersionCommit) {
      version = '0.0.0'
    } else {
      version = lastVersionCommit.version
    }
  } else {
    version = packageJsonData.version
  }

  const patchVersion = semver.inc(version, 'patch')!
  const minorVersion = semver.inc(version, 'minor')!
  const majorVersion = semver.inc(version, 'major')!
  const prepatchVersion = semver.inc(version, 'prepatch', true, identifier)!
  const preminorVersion = semver.inc(version, 'preminor', true, identifier)!
  const premajorVersion = semver.inc(version, 'premajor', true, identifier)!
  const prereleaseVersion = semver.inc(version, 'prerelease', true, identifier)!
  const customVersionChoice = 'Custom'
  let newVersionAnswer = await inquirer.prompt<{ newVersion: string }>({
    type: 'list',
    name: 'newVersion',
    message: 'Select a new version:',
    choices: [
      {
        name: `Patch ${version} -> ${patchVersion}`,
        value: patchVersion
      },
      {
        name: `Minor ${version} -> ${minorVersion}`,
        value: minorVersion
      },
      {
        name: `Major ${version} -> ${majorVersion}`,
        value: majorVersion
      },
      {
        name: `Pre Patch ${version} -> ${prepatchVersion}`,
        value: prepatchVersion
      },
      {
        name: `Pre Minor ${version} -> ${preminorVersion}`,
        value: preminorVersion
      },
      {
        name: `Pre Major ${version} -> ${premajorVersion}`,
        value: premajorVersion
      },
      {
        name: `Pre Release ${version} -> ${prereleaseVersion}`,
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

  let effectedWorkspaces: Workspace[][] | undefined
  if (packageJsonData.version) {
    packageJsonData.version = newVersionAnswer.newVersion
    await writeFileAsync(packageJsonPath, JSON.stringify(packageJsonData, null, 2) + '\n')
  } else {
    const allWorkspaces = await readWorkspaceDependenciesAsync()
    if (!lastVersionCommit) {
      effectedWorkspaces = [allWorkspaces]
    } else {
      effectedWorkspaces = await getEffectedWorkspaces(lastVersionCommit.hash, allWorkspaces, newVersionAnswer.newVersion)
    }

    const packages = new Set<string>()
    for (const workspaces of effectedWorkspaces) {
      for (const workspace of workspaces) {
        packages.add(workspace.name)
      }
    }

    for (const workspaces of effectedWorkspaces) {
      for (const workspace of workspaces) {
        const workspacePath = path.resolve(process.cwd(), workspace.path, 'package.json')
        const packageJson: PackageJson = JSON.parse((await readFileAsync(workspacePath)).toString())
        packageJson.version = newVersionAnswer.newVersion
        if (packageJson.dependencies) {
          for (const dependency in packageJson.dependencies) {
            if (packages.has(dependency)) {
              packageJson.dependencies[dependency] = '^' + newVersionAnswer.newVersion
            }
          }
        }
        await writeFileAsync(workspacePath, JSON.stringify(packageJson, null, 2) + '\n')
        await exec(`git add ${workspace.path}/package.json`)
      }
    }
  }

  const stats = await statAsync(csxsPath)
  if (stats && stats.isFile() && !semver.prerelease(newVersionAnswer.newVersion)) {
    const xml = await readFileAsync(csxsPath, 'utf8')
    const obj = xmlJs.xml2js(xml) as unknown as {
      elements?: Array<{
        attributes?: {
          ExtensionBundleVersion?: string
        }
      }>
    }
    if (obj.elements?.[0]?.attributes?.ExtensionBundleVersion) {
      obj.elements[0].attributes.ExtensionBundleVersion = newVersionAnswer.newVersion
    }
    await writeFileAsync(csxsPath, xmlJs.js2xml(obj, { spaces: 2 }) + '\n')
  }

  return {
    version: newVersionAnswer.newVersion,
    effectedWorkspaces,
  }
}

export const csxsPath = path.resolve(process.cwd(), 'CSXS', 'manifest.xml')

interface PackageJson {
  name: string
  version: string
  dependencies?: { [name: string]: string }
  workspaces: string[]
}

/**
 * @public
 */
export async function readWorkspaceDependenciesAsync(): Promise<Workspace[]> {
  const rootPackageJson: PackageJson = JSON.parse((await readFileAsync(path.resolve(process.cwd(), 'package.json'))).toString())
  const workspacesArray = await Promise.all(rootPackageJson.workspaces.map((w) => globAsync(w)))
  const flattenedWorkspaces = new Set<string>()
  workspacesArray.forEach((workspace) => {
    workspace.forEach((w) => {
      flattenedWorkspaces.add(w)
    })
  })
  const flattenedWorkspacesArray = Array.from(flattenedWorkspaces)
  const packageJsons: PackageJson[] = []
  const packageNames = new Set<string>()
  for (const workspace of flattenedWorkspacesArray) {
    const packageJson: PackageJson = JSON.parse((await readFileAsync(path.resolve(workspace, 'package.json'))).toString())
    packageJsons.push(packageJson)
    packageNames.add(packageJson.name)
  }

  return packageJsons.map((p, i) => {
    let dependencies: string[] | undefined
    if (p.dependencies) {
      const workpaceDependencies = Object.keys(p.dependencies).filter((d) => packageNames.has(d))
      if (workpaceDependencies.length > 0) {
        dependencies = workpaceDependencies
      }
    }
    return {
      name: p.name,
      path: flattenedWorkspacesArray[i],
      dependencies,
      version: p.version,
    }
  })
}

interface Workspace {
  name: string;
  path: string;
  dependencies?: string[]
  version: string
}

function getLastestVersionCommit() {
  for (const commit of iterateCommits()) {
    if (commit.kind === 'version') {
      return {
        version: commit.version,
        hash: commit.hash,
      }
    }
  }
  return undefined
}

async function getEffectedWorkspaces(hash: string, workspaces: Workspace[], newVersion: string) {
  const out = await execAsync(`git diff --name-only ${hash} head`)
  const files = out.trim().split('\n')

  let remainWorkspaces: typeof workspaces = []
  let currentWorkspaces: typeof workspaces = []
  const newVersionIsPrereleaseVersion = semver.prerelease(newVersion)
  for (const workspace of workspaces) {
    // if new version is normal release and old version is prerelease, the workspace is effected
    if (!newVersionIsPrereleaseVersion && semver.prerelease(workspace.version)) {
      currentWorkspaces.push(workspace)
    } else if (files.some((f) => f.startsWith(workspace.path))) {
      currentWorkspaces.push(workspace)
    } else if (workspace.dependencies) {
      remainWorkspaces.push(workspace)
    }
  }
  const effectedWorkspaces = [currentWorkspaces]

  while (remainWorkspaces.length > 0) {
    const current = currentWorkspaces.map((c) => c.name)
    currentWorkspaces = []
    workspaces = remainWorkspaces
    remainWorkspaces = []
    for (const workspace of workspaces) {
      if (!workspace.dependencies) {
        continue
      }
      if (workspace.dependencies.some((f) => current.includes(f))) {
        currentWorkspaces.push(workspace)
      } else {
        remainWorkspaces.push(workspace)
      }
    }
    if (currentWorkspaces.length > 0) {
      effectedWorkspaces.push(currentWorkspaces)
    } else {
      break
    }
  }
  return effectedWorkspaces
}

export function exec(command: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    console.log(`${command}...`)
    const subProcess = childProcess.exec(command, (error, stdout) => {
      if (error) {
        reject(error)
      } else {
        resolve(stdout)
      }
    })
    if (subProcess.stdout) {
      subProcess.stdout.pipe(process.stdout)
    }
    if (subProcess.stderr) {
      subProcess.stderr.pipe(process.stderr)
    }
  })
}

