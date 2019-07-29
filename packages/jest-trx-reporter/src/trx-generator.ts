import * as path from 'path'
import * as uuid from 'uuid'
import { XMLElement } from 'xmlbuilder'

import {
  testListAllLoadedResultsId,
  testListNotInListId,
  testOutcomeTable,
  testType,
} from './constants'
import {
  formatDuration,
  getFullTestName,
  getSuitePerTestDuration,
  getTestClassName,
  sanitizeString,
} from './utils'
import { AggregatedResult, TestResult } from '@jest/test-result'

export const renderTestRun = (
  builder: XMLElement,
  startTime: number,
  computerName: string,
  userName?: string,
) =>
  builder
    .att('id', uuid.v4())
    .att(
      'name',
      `${userName}@${computerName} ${new Date(startTime).toISOString()}`,
    )
    .att('runUser', userName)
    .att('xmlns', 'http://microsoft.com/schemas/VisualStudio/TeamTest/2010')

export const renderTestSettings = (parentNode: XMLElement) =>
  parentNode
    .ele('TestSettings')
    .att('name', 'Jest test run')
    .att('id', uuid.v4())

export const renderTimes = (parentNode: XMLElement, startTime: number) => {
  const _startTime = new Date(startTime).toISOString()
  parentNode
    .ele('Times')
    .att('creation', _startTime)
    .att('queuing', _startTime)
    .att('start', _startTime)
}

export const renderResultSummary = (
  parentNode: XMLElement,
  testRunResult: AggregatedResult,
) => {
  const summary = parentNode
    .ele('ResultSummary')
    .att('outcome', testRunResult.success ? 'Passed' : 'Failed')

  summary
    .ele('Counters')
    .att(
      'total',
      testRunResult.numTotalTests + testRunResult.numRuntimeErrorTestSuites,
    )
    .att(
      'executed',
      testRunResult.numTotalTests - testRunResult.numPendingTests,
    )
    .att('passed', testRunResult.numPassedTests)
    .att('failed', testRunResult.numFailedTests)
    .att('error', testRunResult.numRuntimeErrorTestSuites)
}

export const renderTestLists = (parentNode: XMLElement) => {
  const testLists = parentNode.ele('TestLists')

  testLists
    .ele('TestList')
    .att('name', 'Results Not in a List')
    .att('id', testListNotInListId)

  testLists
    .ele('TestList')
    .att('name', 'All Loaded Results')
    .att('id', testListAllLoadedResultsId)
}

export const renderTestSuiteResult = (
  testSuiteResult: TestResult,
  testDefinitionsNode: XMLElement,
  testEntriesNode: XMLElement,
  resultsNode: XMLElement,
  computerName: string,
) => {
  const perTestDuration = getSuitePerTestDuration(testSuiteResult)
  const perTestDurationFormatted = formatDuration(perTestDuration)

  if (testSuiteResult.testResults && testSuiteResult.testResults.length) {
    testSuiteResult.testResults.forEach((testResult, index) => {
      const testId = uuid.v4()
      const executionId = uuid.v4()
      const fullTestName = getFullTestName(testResult)

      // UnitTest
      const unitTest = testDefinitionsNode
        .ele('UnitTest')
        .att('name', fullTestName)
        .att('id', testId)
      unitTest.ele('Execution').att('id', executionId)
      unitTest
        .ele('TestMethod')
        .att('codeBase', `Jest_${fullTestName}`)
        .att('name', fullTestName)
        .att('className', getTestClassName(testResult))

      // TestEntry
      testEntriesNode
        .ele('TestEntry')
        .att('testId', testId)
        .att('executionId', executionId)
        .att('testListId', testListNotInListId)

      // UnitTestResult
      const result = resultsNode
        .ele('UnitTestResult')
        .att('testId', testId)
        .att('executionId', executionId)
        .att('testName', fullTestName)
        .att('computerName', computerName)
        .att('duration', perTestDurationFormatted)
        .att(
          'startTime',
          new Date(
            testSuiteResult.perfStats.start + index * perTestDuration,
          ).toISOString(),
        )
        .att(
          'endTime',
          new Date(
            testSuiteResult.perfStats.start + (index + 1) * perTestDuration,
          ).toISOString(),
        )
        .att('testType', testType)
        .att('outcome', testOutcomeTable[testResult.status])
        .att('testListId', testListNotInListId)

      if (testResult.status === 'failed') {
        result
          .ele('Output')
          .ele('ErrorInfo')
          .ele('Message', sanitizeString(testResult.failureMessages.join('\n')))
      }
    })

    if (testSuiteResult.console) {
      testSuiteResult.console.forEach(logEntry => {
        resultsNode.ele('Output').ele('StdOut', logEntry.message)
      })
    }
  } else if (testSuiteResult.failureMessage) {
    // For suites that failed to run, we will generate a test result that documents the failure.
    // This occurs when there is a failure compiling/loading the suite, not when a test in the suite fails.
    const testId = uuid.v4()
    const executionId = uuid.v4()
    const fullTestName = path.basename(testSuiteResult.testFilePath)
    const time = new Date().toISOString()

    // Failed TestSuite
    const unitTest = testDefinitionsNode
      .ele('UnitTest')
      .att('name', fullTestName)
      .att('id', testId)
    unitTest.ele('Execution').att('id', executionId)
    unitTest
      .ele('TestMethod')
      .att('codeBase', `Jest_${fullTestName}`)
      .att('name', fullTestName)
      .att('className', fullTestName)
    // TestEntry
    testEntriesNode
      .ele('TestEntry')
      .att('testId', testId)
      .att('executionId', executionId)
      .att('testListId', testListNotInListId)
    // UnitTestResult
    const result = resultsNode
      .ele('UnitTestResult')
      .att('testId', testId)
      .att('executionId', executionId)
      .att('testName', fullTestName)
      .att('computerName', computerName)
      .att('duration', '0')
      .att('startTime', time)
      .att('endTime', time)
      .att('testType', testType)
      .att('outcome', testOutcomeTable.failed)
      .att('testListId', testListNotInListId)
    result
      .ele('Output')
      .ele('ErrorInfo')
      .ele('Message', sanitizeString(testSuiteResult.failureMessage))
  }
}
