import minimist from 'minimist'
import * as semver from 'semver'
import { gitCommitToChangeLog } from 'git-commits-to-changelog'
import { askVersion, statAsync, csxsPath, writeFileAsync, exec, Options } from './core'

import * as packageJson from '../package.json'

let suppressError: boolean | undefined = false

function showToolVersion() {
  console.log(`Version: ${packageJson.version}`)
}

function showHelp() {
  console.log(`Version ${packageJson.version}
Syntax:   npm-version-cli [options]
Examples: npm-version-cli
          npm-version-cli --changelog
          npm-version-cli --append-changelog
          npm-version-cli --only-changed-packages
          npm-version-cli --effected-packages foo --effected-packages bar
Options:
 -h, --help                                         Print this message.
 -v, --version                                      Print the version
 --changelog                                        Generate CHANGELOG.md
 --append-changelog                                 Append CHANGELOG.md
 --only-changed-packages                            Only changed packages will bump.
 --effected-packages                                The packages will be considered as effected packages.
`)
}

async function executeCommandLine() {
  const argv = minimist(process.argv.slice(2), { '--': true }) as {
    version?: string
    v?: string
    suppressError?: boolean
    h?: unknown
    help?: unknown
    changelog?: unknown
    'append-changelog'?: boolean
    'only-changed-packages'?: unknown
    'effected-packages'?: unknown
  }

  const showVersion = argv.v || argv.version
  if (showVersion) {
    showToolVersion()
    return
  }

  if (argv.h || argv.help) {
    showHelp()
    process.exit(0)
  }

  suppressError = argv.suppressError

  const effectedPackages: string[] = []
  if (typeof argv["effected-packages"] === 'string') {
    effectedPackages.push(argv["effected-packages"])
  } else if (Array.isArray(argv["effected-packages"])) {
    effectedPackages.push(...argv["effected-packages"])
  }
  const options: Partial<Options> = {
    onlyChangedPackages: !!argv['only-changed-packages'],
    effectedPackages,
  }
  const { version } = await askVersion(options)
  await exec(`git add package.json`)

  const stats = await statAsync(csxsPath)
  if (stats && stats.isFile() && !semver.prerelease(version)) {
    await exec(`git add ${csxsPath}`)
  }

  if (argv.changelog || argv['append-changelog']) {
    const changelog = await gitCommitToChangeLog(version, argv['append-changelog'])
    await writeFileAsync('CHANGELOG.md', changelog)
    await exec(`git add CHANGELOG.md`)
  }

  await exec(`git commit -m "${version}"`)
  await exec(`git tag -a v${version} -m 'v${version}'`)
}

executeCommandLine().then(() => {
  console.log(`npm-version-cli success.`)
}, (error: Error) => {
  if (error instanceof Error) {
    console.log(error.message)
  } else {
    console.log(error)
  }
  if (!suppressError) {
    process.exit(1)
  }
})
