import minimist from 'minimist'
import * as childProcess from 'child_process'
import * as semver from 'semver'
import { askVersion, statAsync, csxsPath } from './core'

import * as packageJson from '../package.json'

let suppressError: boolean | undefined = false

function showToolVersion() {
  console.log(`Version: ${packageJson.version}`)
}

function exec(command: string) {
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

async function executeCommandLine() {
  const argv = minimist(process.argv.slice(2), { '--': true }) as {
    version?: string
    v?: string
    suppressError?: boolean
  }

  const showVersion = argv.v || argv.version
  if (showVersion) {
    showToolVersion()
    return
  }

  suppressError = argv.suppressError

  const version = await askVersion()
  await exec(`git add package.json`)

  const stats = await statAsync(csxsPath)
  if (stats && stats.isFile() && !semver.prerelease(version)) {
    await exec(`git add ${csxsPath}`)
  }

  await exec(`git commit -m "${version}"`)
  await exec(`git tag -a v${version} -m 'v${version}'`)
}

executeCommandLine().then(() => {
  console.log(`npm-version-cli success.`)
}, error => {
  if (error instanceof Error) {
    console.log(error.message)
  } else {
    console.log(error)
  }
  if (!suppressError) {
    process.exit(1)
  }
})
