import { create as createXmlBuilder } from 'xmlbuilder'
import { writeFileSync } from 'fs'
import {
  Reporter,
  Test,
  Context,
  ReporterOnStartOptions,
} from '@jest/reporters/build/types'
import { TestResult, AggregatedResult } from '@jest/test-result'
import { GlobalConfig } from '@jest/types/build/Config'

import {
  renderTestRun,
  renderTestSettings,
  renderTimes,
  renderResultSummary,
  renderTestLists,
  renderTestSuiteResult,
} from './trx-generator'
import { getEnvInfo } from './utils'

type Options = {
  includeConsoleOutput: boolean
}

class TrxReporter implements Reporter {
  options: Options
  buffer: any = {}

  constructor(globalConfig: GlobalConfig, options: Options) {
    this.options = options
  }

  onTestResult(
    test: Test,
    testResult: TestResult,
    aggregatedResult: AggregatedResult,
  ): void | Promise<void> {
    if (
      this.options.includeConsoleOutput &&
      testResult.console &&
      testResult.console.length > 0
    ) {
      this.buffer[testResult.testFilePath] = testResult.console
    }
  }

  onRunStart(
    results: AggregatedResult,
    options: ReporterOnStartOptions,
  ): void | Promise<void> {}

  onTestStart(test: Test): void | Promise<void> {}

  onRunComplete(
    contexts: Set<Context>,
    results: AggregatedResult,
  ): void | Promise<void> {
    results.testResults.forEach(t => (t.console = this.buffer[t.testFilePath]))

    const { computerName, userName } = getEnvInfo()

    const resultBuilder = createXmlBuilder('TestRun', {
      version: '1.0',
      encoding: 'UTF-8',
    })

    renderTestRun(resultBuilder, results.startTime, computerName, userName)

    renderTestSettings(resultBuilder)

    renderTimes(resultBuilder, results.startTime)

    renderResultSummary(resultBuilder, results)

    const testDefinitions = resultBuilder.ele('TestDefinitions')

    renderTestLists(resultBuilder)

    const testEntries = resultBuilder.ele('TestEntries')
    const res = resultBuilder.ele('Results')

    results.testResults.forEach(testSuiteResult =>
      renderTestSuiteResult(
        testSuiteResult,
        testDefinitions,
        testEntries,
        res,
        computerName,
      ),
    )

    const trx = resultBuilder.end({ pretty: true })
    writeFileSync('output.trx', trx, { encoding: 'utf8' })
  }

  getLastError(): void | Error {}
}

export = TrxReporter
